import { toRaw } from 'vue'

import { downloadBlob } from '@/base/common/downloadUtil'
import { t } from '@/i18n'
import type { Point, SerialisableGraph } from '@/lib/litegraph/src/litegraph'
import { useSettingStore } from '@/platform/settings/settingStore'
import { useToastStore } from '@/platform/updates/common/toastStore'
import {
  normalizePendingWarnings,
  updatePendingWarnings
} from '@/platform/workflow/core/utils/pendingWarnings'
import { workflowToClipboardItems } from '@/platform/workflow/core/utils/workflowToClipboardItems'
import {
  areWorkflowIdsEquivalent,
  ensureWorkflowId,
  getLegacyWorkflowId
} from '@/platform/workflow/core/utils/workflowId'
import { useWorkflowDraftStoreV2 } from '@/platform/workflow/persistence/stores/workflowDraftStoreV2'
import {
  ComfyWorkflow,
  useWorkflowStore
} from '@/platform/workflow/management/stores/workflowStore'
import { useTelemetry } from '@/platform/telemetry'
import type { ComfyWorkflowJSON } from '@/platform/workflow/validation/schemas/workflowSchema'
// eslint-disable-next-line import-x/no-restricted-paths
import { useWorkflowThumbnail } from '@/renderer/core/thumbnail/useWorkflowThumbnail'
import { app } from '@/scripts/app'
import { isSelectOnly } from '@/utils/litegraphUtil'
import { blankGraph, defaultGraph } from '@/scripts/defaultGraph'
import { useDialogService } from '@/services/dialogService'
import { useAppMode } from '@/composables/useAppMode'
import { useDomWidgetStore } from '@/stores/domWidgetStore'
import { useAppModeStore } from '@/stores/appModeStore'
import { useExecutionErrorStore } from '@/stores/executionErrorStore'
import { useNodeOutputStore } from '@/stores/nodeOutputStore'
import { useSubgraphNavigationStore } from '@/stores/subgraphNavigationStore'
import { reportError } from '@/platform/telemetry/reportError'
import { useMissingNodesErrorStore } from '@/platform/nodeReplacement/missingNodesErrorStore'
import { useMissingModelStore } from '@/platform/missingModel/missingModelStore'
import { useMissingMediaStore } from '@/platform/missingMedia/missingMediaStore'
import { useWorkspaceStore } from '@/stores/workspaceStore'
import {
  appendJsonExt,
  appendWorkflowJsonExt,
  generateUUID
} from '@/utils/formatUtil'
import type { AppMode } from '@/utils/appMode'

function linearModeToAppMode(linearMode: unknown): AppMode | null {
  if (typeof linearMode !== 'boolean') return null
  return linearMode ? 'app' : 'graph'
}

// TRANSITIONAL (decision log D14): deletable when ECS scopes workflow
// loading per document; the contract tests transfer.
let workflowLoadTail: Promise<unknown> = Promise.resolve()
let pendingWorkflowLoads = 0
const pendingWorkflowLoadsByPath = new Map<string, Promise<unknown>>()
// Object identity, not path: a mid-close rename would strand a path key.
const closingWorkflowCounts = new Map<ComfyWorkflow, number>()

/** The registry key: raw instance, so reactive proxies and raw references agree. */
function closingKey(workflow: ComfyWorkflow): ComfyWorkflow {
  return toRaw(workflow)
}

/** @internal Test-only: clears the module-level load queue between tests. */
export function resetWorkflowLoadQueueForTests(): {
  pendingLoads: number
  closingCount: number
  pendingPaths: number
} {
  const drained = {
    pendingLoads: pendingWorkflowLoads,
    closingCount: closingWorkflowCounts.size,
    pendingPaths: pendingWorkflowLoadsByPath.size
  }
  workflowLoadTail = Promise.resolve()
  pendingWorkflowLoads = 0
  pendingWorkflowLoadsByPath.clear()
  closingWorkflowCounts.clear()
  return drained
}

function queueWorkflowLoad<T>(
  load: () => Promise<T>,
  workflowPath?: string
): Promise<T> {
  pendingWorkflowLoads++
  const result = workflowLoadTail.then(load)
  const settledResult = result
    .catch((error) => {
      // Keep fire-and-forget load failures observable.
      console.error('[workflowService] queued workflow load failed', error)
      reportError(error, { errorType: 'workflow_load_failure' })
      return undefined
    })
    .finally(() => {
      pendingWorkflowLoads--
      if (
        workflowPath &&
        pendingWorkflowLoadsByPath.get(workflowPath) === settledResult
      ) {
        pendingWorkflowLoadsByPath.delete(workflowPath)
      }
    })
  workflowLoadTail = settledResult
  if (workflowPath) {
    pendingWorkflowLoadsByPath.set(workflowPath, settledResult)
  }
  return result
}

export const useWorkflowService = () => {
  const settingStore = useSettingStore()
  const workflowStore = useWorkflowStore()
  const toastStore = useToastStore()
  const dialogService = useDialogService()
  const workflowThumbnail = useWorkflowThumbnail()
  const domWidgetStore = useDomWidgetStore()
  const missingNodesErrorStore = useMissingNodesErrorStore()
  const workflowDraftStore = useWorkflowDraftStoreV2()

  const showFailedToSaveDraftToast = () => {
    toastStore.add({
      severity: 'error',
      summary: t('g.error'),
      detail: t('toastMessages.failedToSaveDraft')
    })
  }

  const persistActiveWorkflowDraft = (activeWorkflow: ComfyWorkflow) => {
    if (!settingStore.get('Comfy.Workflow.Persist') || !activeWorkflow.path) {
      return
    }

    const activeState = activeWorkflow.activeState
    if (!activeState) return

    try {
      const saved = workflowDraftStore.saveDraft(
        activeWorkflow.path,
        JSON.stringify(activeState),
        {
          name: activeWorkflow.key,
          isTemporary: activeWorkflow.isTemporary
        }
      )

      if (!saved) {
        showFailedToSaveDraftToast()
      }
    } catch (err) {
      console.error('Failed to persist active workflow draft', err)
      showFailedToSaveDraftToast()
    }
  }

  function confirmOverwrite(targetPath: string) {
    return dialogService.confirm({
      title: t('sideToolbar.workflowTab.confirmOverwriteTitle'),
      type: 'overwrite',
      message: t('sideToolbar.workflowTab.confirmOverwrite'),
      itemList: [targetPath]
    })
  }

  async function getFilename(defaultName: string): Promise<string | null> {
    if (settingStore.get('Comfy.PromptFilename')) {
      let filename = await dialogService.prompt({
        title: t('workflowService.exportWorkflow'),
        message: t('workflowService.enterFilenamePrompt'),
        defaultValue: defaultName
      })
      if (!filename) return null
      if (!filename.toLowerCase().endsWith('.json')) {
        filename += '.json'
      }
      return filename
    }
    return defaultName
  }

  /**
   * Adds scale and offset from litegraph canvas to the workflow JSON.
   * @param workflow The workflow to add the view restore data to
   */
  function addViewRestore(workflow: ComfyWorkflowJSON) {
    if (!settingStore.get('Comfy.EnableWorkflowViewRestore')) return

    const { offset, scale } = app.canvas.ds
    const [x, y] = offset

    workflow.extra ??= {}
    workflow.extra.ds = { scale, offset: [x, y] }
  }

  /**
   * Export the current workflow as a JSON file
   * @param filename The filename to save the workflow as
   * @param promptProperty The property of the prompt to export
   */
  const exportWorkflow = async (
    filename: string,
    promptProperty: 'workflow' | 'output'
  ): Promise<void> => {
    const workflow = workflowStore.activeWorkflow
    if (workflow?.path) {
      filename = workflow.filename
    }
    const p = await app.graphToPrompt()

    addViewRestore(p.workflow)
    const json = JSON.stringify(p[promptProperty], null, 2)
    const blob = new Blob([json], { type: 'application/json' })
    const file = await getFilename(filename)
    if (!file) return
    downloadBlob(file, blob)
  }
  /**
   * Save a workflow as a new file
   * @param workflow The workflow to save
   * @param options.filename Pre-supplied filename (skips the prompt dialog)
   */
  const saveWorkflowAs = async (
    workflow: ComfyWorkflow,
    options: { filename?: string; isApp?: boolean } = {}
  ): Promise<boolean> => {
    const newFilename = options.filename ?? (await workflow.promptSave())
    if (!newFilename) return false

    const isApp = options.isApp ?? workflow.initialMode === 'app'
    const newPath =
      workflow.directory + '/' + appendWorkflowJsonExt(newFilename, isApp)
    const existingWorkflow = workflowStore.getWorkflowByPath(newPath)

    const isSelfOverwrite =
      existingWorkflow?.path === workflow.path && !existingWorkflow?.isTemporary

    if (existingWorkflow && !existingWorkflow.isTemporary) {
      if ((await confirmOverwrite(newPath)) !== true) return false

      if (!isSelfOverwrite) {
        const deleted = await deleteWorkflow(existingWorkflow, true)
        if (!deleted) return false
      }
    }

    if (isSelfOverwrite) {
      workflow.changeTracker?.prepareForSave()
      // Call workflowStore.saveWorkflow directly: saveWorkflowAs emits its own is_new:true event below, so delegating to saveWorkflow() would also fire is_new:false and run prepareForSave a second time.
      await workflowStore.saveWorkflow(workflow)
    } else {
      let target: ComfyWorkflow
      if (workflow.isTemporary) {
        await renameWorkflow(workflow, newPath)
        target = workflow
      } else {
        target = workflowStore.saveAs(workflow, newPath)
        await openWorkflow(target)
      }

      if (options.isApp !== undefined) {
        app.rootGraph.extra ??= {}
        app.rootGraph.extra.linearMode = isApp
        target.initialMode = isApp ? 'app' : 'graph'
      }
      target.changeTracker?.prepareForSave()
      await workflowStore.saveWorkflow(target)
    }

    useTelemetry()?.trackWorkflowSaved({ is_app: isApp, is_new: true })
    return true
  }

  /**
   * Save a workflow
   * @param workflow The workflow to save
   */
  const saveWorkflow = async (workflow: ComfyWorkflow): Promise<boolean> => {
    if (workflow.isTemporary) {
      return await saveWorkflowAs(workflow)
    }

    workflow.changeTracker?.prepareForSave()
    const isApp = workflow.initialMode === 'app'
    const expectedPath =
      workflow.directory + '/' + appendWorkflowJsonExt(workflow.filename, isApp)
    if (workflow.path !== expectedPath) {
      const existing = workflowStore.getWorkflowByPath(expectedPath)
      if (existing && !existing.isTemporary) {
        if ((await confirmOverwrite(expectedPath)) !== true) {
          await workflowStore.saveWorkflow(workflow)
          return true
        }
        await deleteWorkflow(existing, true)
      }
      await renameWorkflow(workflow, expectedPath)
      toastStore.add({
        severity: 'info',
        summary: t(
          isApp
            ? 'workflowService.savedAsApp'
            : 'workflowService.savedAsWorkflow'
        ),
        life: 3000
      })
    }

    await workflowStore.saveWorkflow(workflow)
    useTelemetry()?.trackWorkflowSaved({ is_app: isApp, is_new: false })
    return true
  }

  /**
   * Load the default workflow
   */
  const loadDefaultWorkflow = () =>
    queueWorkflowLoad(() => app.loadGraphData(defaultGraph))

  /**
   * Load a blank workflow
   */
  const loadBlankWorkflow = () =>
    queueWorkflowLoad(() => app.loadGraphData(blankGraph))

  /**
   * Reload the current workflow
   * This is used to refresh the node definitions update, e.g. when the locale changes.
   */
  const reloadCurrentWorkflow = async () => {
    const workflow = workflowStore.activeWorkflow
    if (workflow) {
      await openWorkflow(workflow, { force: true })
    }
  }

  /**
   * Open a workflow in the current workspace
   * @param workflow The workflow to open
   * @param options The options for opening the workflow
   * @returns false when the graph load reported failure (the error
   * dialog was shown and the workflow never painted) or when the open
   * was skipped because the workflow is mid-close; true otherwise
   */
  /**
   * A failed replacement load leaves the shared root graph cleaned or
   * partially configured while the previous workflow stays selected
   * (16075 review). Repaint the retained workflow from its just-saved
   * state so selection, canvas, and change tracking agree again. No
   * retry loop: a failure here leaves the first failure's dialog
   * standing.
   */
  const restoreRetainedWorkflow = async (failed: ComfyWorkflow) => {
    const retained = workflowStore.activeWorkflow
    if (!retained || retained.path === failed.path || !retained.isLoaded) return
    await app.loadGraphData(
      toRaw(retained.activeState) as ComfyWorkflowJSON,
      /* clean=*/ true,
      /* restore_view=*/ true,
      retained,
      {
        checkForRerouteMigration: false,
        deferWarnings: true,
        skipAssetScans: true
      }
    )
  }

  const openWorkflow = (
    workflow: ComfyWorkflow,
    options: { force?: boolean; navigationIntentId?: number } = {}
  ): Promise<boolean> => {
    if (closingWorkflowCounts.has(closingKey(workflow)))
      return Promise.resolve(false)
    if (
      pendingWorkflowLoads === 0 &&
      workflowStore.isActive(workflow) &&
      !options.force
    ) {
      return Promise.resolve(true)
    }

    const navigationIntentId =
      options.navigationIntentId ??
      useSubgraphNavigationStore().beginWorkflowNavigation()
    return queueWorkflowLoad(async () => {
      try {
        const loadFromRemote = !workflow.isLoaded
        if (loadFromRemote) {
          await workflow.load()
        }

        const loaded = await app.loadGraphData(
          toRaw(workflow.activeState) as ComfyWorkflowJSON,
          /* clean=*/ true,
          /* restore_view=*/ true,
          workflow,
          {
            checkForRerouteMigration: false,
            deferWarnings: true,
            skipAssetScans: !loadFromRemote && !options.force,
            workflowNavigationId: navigationIntentId
          }
        )
        if (loaded === false) {
          // Same invariant as the catch: a failed load's intent must not
          // stay newest (guarded no-op when the publish already superseded).
          useSubgraphNavigationStore().endWorkflowNavigation(navigationIntentId)
          await restoreRetainedWorkflow(workflow)
          return false
        }
        showPendingWarnings(undefined, {
          silent: !loadFromRemote && !options.force
        })
        return loaded
      } catch (error) {
        // A failed load's intent must not stay newest (suppresses the survivor's hash).
        useSubgraphNavigationStore().endWorkflowNavigation(navigationIntentId)
        throw error
      }
    }, workflow.path)
  }

  /**
   * Close a workflow with confirmation if there are unsaved changes
   * @param workflow The workflow to close
   * @returns true if the workflow was closed; false if the user
   * cancelled or the replacement/default load reported failure (the
   * workflow then stays open with its draft intact)
   */
  const closeWorkflow = async (
    workflow: ComfyWorkflow,
    options: { warnIfUnsaved: boolean; hint?: string } = {
      warnIfUnsaved: true
    }
  ): Promise<boolean> => {
    if (workflow.isModified && options.warnIfUnsaved) {
      const confirmed = await dialogService.confirm({
        title: t('sideToolbar.workflowTab.dirtyCloseTitle'),
        type: 'dirtyClose',
        message: t('sideToolbar.workflowTab.dirtyClose'),
        itemList: [workflow.path],
        hint: options.hint,
        denyLabel: t('sideToolbar.workflowTab.dirtyCloseAnyway')
      })
      // Cancel
      if (confirmed === null) return false

      if (confirmed === true) {
        const saved = await saveWorkflow(workflow)
        if (!saved) return false
      }
    }

    // Captured once: a mid-close rename mutates workflow.path in place.
    const closingPath = workflow.path
    const closing = closingKey(workflow)
    closingWorkflowCounts.set(
      closing,
      (closingWorkflowCounts.get(closing) ?? 0) + 1
    )
    try {
      const wasActive = workflowStore.isActive(workflow)
      const pendingWorkflowLoad = pendingWorkflowLoadsByPath.get(closingPath)
      if (!wasActive && pendingWorkflowLoad) await pendingWorkflowLoad
      if (
        wasActive ||
        (pendingWorkflowLoad && workflowStore.isActive(workflow))
      ) {
        // Bounded drain: quiesce for the replacement decision without letting
        // a hot enqueue stream starve the close.
        for (let spins = 0; spins < 16; spins++) {
          const observedOpenTail = workflowLoadTail
          await observedOpenTail
          if (observedOpenTail === workflowLoadTail) break
        }
      }

      // If this is the active workflow, load the most recent workflow from history
      if (workflowStore.isActive(workflow)) {
        const mostRecentWorkflow = workflowStore.getMostRecentWorkflow()
        let replacementWorkflow =
          mostRecentWorkflow &&
          !closingWorkflowCounts.has(closingKey(mostRecentWorkflow))
            ? mostRecentWorkflow
            : undefined
        for (
          let shift = 1;
          !replacementWorkflow && shift < workflowStore.openWorkflows.length;
          shift++
        ) {
          const candidate = workflowStore.openedWorkflowIndexShift(shift)
          if (candidate && !closingWorkflowCounts.has(closingKey(candidate))) {
            replacementWorkflow = candidate
          }
        }
        // `=== false` on purpose: only an EXPLICIT failure report aborts
        // the close (a real configure failure resolves false - the dialog
        // path); a rejection still propagates as before.
        if (replacementWorkflow) {
          if ((await openWorkflow(replacementWorkflow)) === false) return false
        } else {
          if ((await loadDefaultWorkflow()) === false) return false
        }
      } else if (
        // Read live, post-drain: the awaits above can change the answer.
        workflowStore.openWorkflows.length > 0 &&
        workflowStore.openWorkflows.every((open) =>
          closingWorkflowCounts.has(closingKey(open))
        )
      ) {
        if ((await loadDefaultWorkflow()) === false) return false
      }

      await workflowStore.closeWorkflow(workflow)
      // Only after the close is real: a still-open tab keeps its draft.
      workflowDraftStore.removeDraft(closingPath)
      useNodeOutputStore().discardPreviewsForWorkflow(closingPath)
      return true
    } finally {
      const remainingCloses = closingWorkflowCounts.get(closing) ?? 0
      if (remainingCloses <= 1) {
        closingWorkflowCounts.delete(closing)
      } else {
        closingWorkflowCounts.set(closing, remainingCloses - 1)
      }
    }
  }

  const renameWorkflow = async (workflow: ComfyWorkflow, newPath: string) => {
    await workflowStore.renameWorkflow(workflow, newPath)
  }

  /**
   * Delete a workflow
   * @param workflow The workflow to delete
   * @returns `true` if the workflow was deleted; `false` if the user
   * cancelled or the close was aborted by a failed replacement load
   */
  const deleteWorkflow = async (
    workflow: ComfyWorkflow,
    silent = false
  ): Promise<boolean> => {
    const bypassConfirm = !settingStore.get('Comfy.Workflow.ConfirmDelete')
    let confirmed: boolean | null = bypassConfirm || silent

    if (!confirmed) {
      confirmed = await dialogService.confirm({
        title: t('sideToolbar.workflowTab.confirmDeleteTitle'),
        type: 'delete',
        message: t('sideToolbar.workflowTab.confirmDelete'),
        itemList: [workflow.path]
      })
      if (!confirmed) return false
    }

    if (workflowStore.isOpen(workflow)) {
      const closed = await closeWorkflow(workflow, {
        warnIfUnsaved: !confirmed
      })
      if (!closed) return false
    }
    await workflowStore.deleteWorkflow(workflow)
    if (!silent) {
      toastStore.add({
        severity: 'info',
        summary: t('sideToolbar.workflowTab.deleted'),
        life: 1000
      })
    }
    return true
  }

  /**
   * This method is called before loading a new graph.
   * There are 3 major functions that loads a new graph to the graph editor:
   * 1. loadGraphData
   * 2. loadApiJson
   * 3. importA1111
   *
   * This function is used to save the current workflow states before loading
   * a new graph.
   */
  const beforeLoadNewGraph = (suppressWorkflowReset = true) => {
    // Use workspaceStore here as it is patched in unit tests.
    const workflowStore = useWorkspaceStore().workflow
    const activeWorkflow = workflowStore.activeWorkflow
    if (activeWorkflow) {
      activeWorkflow.changeTracker?.deactivate()
      persistActiveWorkflowDraft(activeWorkflow)
      // Cache missing model/media/node state for restore on tab switch.
      // Always overwrite to reflect the current store state (e.g. after
      // muting a node cleared its errors).
      const modelCandidates = useMissingModelStore().missingModelCandidates
      const mediaCandidates = useMissingMediaStore().missingMediaCandidates
      const nodeTypes = missingNodesErrorStore.missingNodesError?.nodeTypes
      updatePendingWarnings(activeWorkflow, {
        missingNodeTypes: nodeTypes?.length ? [...nodeTypes] : undefined,
        missingModelCandidates: modelCandidates ?? undefined,
        missingMediaCandidates: mediaCandidates ?? undefined
      })

      // Hand the previews to the store before `app.clean()` revokes them
      useNodeOutputStore().stashPreviewsForWorkflow(activeWorkflow.path)

      // Capture thumbnail before loading new graph
      void workflowThumbnail.storeThumbnail(activeWorkflow)
      domWidgetStore.clear()

      // Save subgraph viewport before the canvas gets overwritten
      useSubgraphNavigationStore().saveCurrentViewport(suppressWorkflowReset)
    }
  }

  /**
   * Set the active workflow after the new graph is loaded.
   *
   * The call relationship is
   * useWorkflowService().openWorkflow -> app.loadGraphData -> useWorkflowService().afterLoadNewGraph
   * app.loadApiJson -> useWorkflowService().afterLoadNewGraph
   * app.importA1111 -> useWorkflowService().afterLoadNewGraph
   *
   * @param value The value to set as the active workflow.
   * @param workflowData The initial workflow data loaded to the graph editor.
   */
  const afterLoadNewGraph = async (
    value: string | ComfyWorkflow | null,
    workflowData: ComfyWorkflowJSON,
    shareId?: string
  ) => {
    await activateLoadedWorkflow(value, workflowData, shareId)
    useNodeOutputStore().restorePreviewsForWorkflow(
      useWorkspaceStore().workflow.activeWorkflow?.path
    )
  }

  const activateLoadedWorkflow = async (
    value: string | ComfyWorkflow | null,
    workflowData: ComfyWorkflowJSON,
    shareId?: string
  ) => {
    const workflowStore = useWorkspaceStore().workflow
    const { isAppMode } = useAppMode()
    const wasAppMode = isAppMode.value

    // Determine the initial app mode for fresh loads from serialized state.
    // null means linearMode was never explicitly set (not builder-saved).
    const freshLoadMode = linearModeToAppMode(workflowData.extra?.linearMode)
    useAppModeStore().loadSelections(workflowData.extra?.linearData)

    function trackIfEnteringApp(workflow: ComfyWorkflow) {
      if (!wasAppMode && workflow.initialMode === 'app') {
        useTelemetry()?.trackEnterLinear({ source: 'workflow' })
      }
    }

    if (value === null || typeof value === 'string') {
      const path = value as string | null

      // Check if a persisted workflow with this path exists
      if (path) {
        const fullPath = ComfyWorkflow.basePath + appendJsonExt(path)
        const existingWorkflow = workflowStore.getWorkflowByPath(fullPath)

        // Reuse an existing workflow when this is a restoration case
        // (persisted but currently unloaded) or an idempotent repeated load
        // of the currently active same-path workflow.
        //
        // This prevents accidental duplicate tabs when startup/load flows
        // invoke loadGraphData more than once for the same workflow name.
        const existingId = existingWorkflow?.activeState?.id
        const isSameActiveWorkflowLoad =
          !!existingWorkflow &&
          workflowStore.isActive(existingWorkflow) &&
          areWorkflowIdsEquivalent(
            existingId,
            workflowData.id,
            existingWorkflow.legacyId
          )

        if (
          existingWorkflow &&
          ((existingWorkflow.isPersisted && !existingWorkflow.isLoaded) ||
            isSameActiveWorkflowLoad)
        ) {
          const loadedWorkflow =
            await workflowStore.openWorkflow(existingWorkflow)
          if (loadedWorkflow.initialMode === undefined) {
            // Prefer the file's linearMode over the draft's since the file
            // is the authoritative saved state.
            loadedWorkflow.initialMode =
              linearModeToAppMode(
                loadedWorkflow.initialState?.extra?.linearMode
              ) ?? freshLoadMode
            trackIfEnteringApp(loadedWorkflow)
          }
          if (shareId) {
            loadedWorkflow.shareId = shareId
          }
          loadedWorkflow.legacyId ??= getLegacyWorkflowId(workflowData.id)
          loadedWorkflow.changeTracker.reset(
            ensureWorkflowId(workflowData, loadedWorkflow.activeState?.id)
          )
          loadedWorkflow.changeTracker.restore()
          return
        }
      }

      const tempWorkflow = workflowStore.createNewTemporary(
        path ? appendJsonExt(path) : undefined,
        workflowData
      )
      tempWorkflow.initialMode = freshLoadMode
      if (shareId) {
        tempWorkflow.shareId = shareId
      }
      trackIfEnteringApp(tempWorkflow)
      await workflowStore.openWorkflow(tempWorkflow)
      return
    }

    const loadedWorkflow = await workflowStore.openWorkflow(value)
    if (shareId) {
      loadedWorkflow.shareId = shareId
    }
    if (loadedWorkflow.initialMode === undefined) {
      loadedWorkflow.initialMode = freshLoadMode
      trackIfEnteringApp(loadedWorkflow)
    }
    loadedWorkflow.legacyId ??= getLegacyWorkflowId(workflowData.id)
    loadedWorkflow.changeTracker.reset(
      ensureWorkflowId(workflowData, loadedWorkflow.activeState?.id)
    )
    loadedWorkflow.changeTracker.restore()
  }

  /**
   * Insert the given workflow into the current graph editor.
   */
  const insertWorkflow = async (
    workflow: ComfyWorkflow,
    options: { position?: Point } = {}
  ) => {
    const canvas = app.canvas
    if (isSelectOnly(canvas)) return
    const loadedWorkflow = await workflow.load()
    if (app.canvas !== canvas || isSelectOnly(canvas)) return
    const workflowJSON = toRaw(loadedWorkflow.initialState)
    // unknown conversion: ComfyWorkflowJSON is stricter than LiteGraph's
    // serialisation schema.
    const items = workflowToClipboardItems(
      workflowJSON as unknown as SerialisableGraph
    )
    canvas._deserializeItems(items, options)
  }

  const loadNextOpenedWorkflow = async () => {
    const nextWorkflow = workflowStore.openedWorkflowIndexShift(1)
    if (nextWorkflow) {
      await openWorkflow(nextWorkflow)
    }
  }

  const loadPreviousOpenedWorkflow = async () => {
    const previousWorkflow = workflowStore.openedWorkflowIndexShift(-1)
    if (previousWorkflow) {
      await openWorkflow(previousWorkflow)
    }
  }

  /**
   * Takes an existing workflow and duplicates it with a new name
   */
  const duplicateWorkflow = async (workflow: ComfyWorkflow) => {
    if (!workflow.isLoaded) await workflow.load()
    const state = JSON.parse(JSON.stringify(workflow.activeState))
    // Ensure duplicates are always treated as distinct workflows.
    if (state) state.id = generateUUID()
    const suffix = workflow.isPersisted ? ' (Copy)' : ''
    // Remove the suffix `(2)` or similar
    const filename = workflow.filename.replace(/\s*\(\d+\)$/, '') + suffix

    await queueWorkflowLoad(() =>
      app.loadGraphData(state, true, true, filename)
    )
  }

  /**
   * Show and clear any pending warnings (missing nodes/models) stored on the
   * active workflow. Called after a workflow becomes visible so dialogs don't
   * overlap with subsequent loads.
   */
  function showPendingWarnings(
    workflow?: ComfyWorkflow | null,
    options?: { silent?: boolean }
  ) {
    const wf = workflow ?? workflowStore.activeWorkflow
    if (!wf) return

    const { missingNodeTypes, missingModelCandidates, missingMediaCandidates } =
      wf.pendingWarnings ?? {}

    // Always sync missing nodes store (clear when empty).
    if (
      missingNodesErrorStore.surfaceMissingNodes(missingNodeTypes ?? []) &&
      !options?.silent
    ) {
      useExecutionErrorStore().showErrorOverlay()
    }
    if (missingModelCandidates?.length) {
      useMissingModelStore().setMissingModels(missingModelCandidates)
    }
    if (missingMediaCandidates?.length) {
      useMissingMediaStore().setMissingMedia(missingMediaCandidates)
    }

    // Keep cache for future tab switches
    if (
      missingNodeTypes?.length ||
      missingModelCandidates?.length ||
      missingMediaCandidates?.length
    ) {
      wf.pendingWarnings = normalizePendingWarnings({
        missingNodeTypes,
        missingModelCandidates,
        missingMediaCandidates
      })
    } else {
      wf.pendingWarnings = null
    }
  }

  return {
    exportWorkflow,
    saveWorkflowAs,
    saveWorkflow,
    loadDefaultWorkflow,
    loadBlankWorkflow,
    reloadCurrentWorkflow,
    openWorkflow,
    closeWorkflow,
    renameWorkflow,
    deleteWorkflow,
    insertWorkflow,
    loadNextOpenedWorkflow,
    loadPreviousOpenedWorkflow,
    duplicateWorkflow,
    showPendingWarnings,
    afterLoadNewGraph,
    beforeLoadNewGraph
  }
}
