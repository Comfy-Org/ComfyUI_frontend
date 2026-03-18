import { toRaw } from 'vue'

import { downloadBlob } from '@/base/common/downloadUtil'
import { t } from '@/i18n'
import { LGraph, LGraphCanvas } from '@/lib/litegraph/src/litegraph'
import type { Point, SerialisableGraph } from '@/lib/litegraph/src/litegraph'
import { useSettingStore } from '@/platform/settings/settingStore'
import { useToastStore } from '@/platform/updates/common/toastStore'
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
import { blankGraph, defaultGraph } from '@/scripts/defaultGraph'
import { useDialogService } from '@/services/dialogService'
import { useAppMode } from '@/composables/useAppMode'
import type { AppMode } from '@/composables/useAppMode'
import { useDomWidgetStore } from '@/stores/domWidgetStore'
import { useExecutionErrorStore } from '@/stores/executionErrorStore'
import { useWorkspaceStore } from '@/stores/workspaceStore'
import {
  appendJsonExt,
  appendWorkflowJsonExt,
  generateUUID
} from '@/utils/formatUtil'

function linearModeToAppMode(linearMode: unknown): AppMode | null {
  if (typeof linearMode !== 'boolean') return null
  return linearMode ? 'app' : 'graph'
}

export const useWorkflowService = () => {
  const settingStore = useSettingStore()
  const workflowStore = useWorkflowStore()
  const toastStore = useToastStore()
  const dialogService = useDialogService()
  const workflowThumbnail = useWorkflowThumbnail()
  const domWidgetStore = useDomWidgetStore()
  const executionErrorStore = useExecutionErrorStore()
  const workflowDraftStore = useWorkflowDraftStoreV2()

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
    options: { filename?: string } = {}
  ): Promise<boolean> => {
    const newFilename = options.filename ?? (await workflow.promptSave())
    if (!newFilename) return false

    const isApp = workflow.initialMode === 'app'
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

    workflow.changeTracker?.checkState()

    if (isSelfOverwrite) {
      await saveWorkflow(workflow)
    } else if (workflow.isTemporary) {
      await renameWorkflow(workflow, newPath)
      await workflowStore.saveWorkflow(workflow)
    } else {
      const tempWorkflow = workflowStore.saveAs(workflow, newPath)
      await openWorkflow(tempWorkflow)
      await workflowStore.saveWorkflow(tempWorkflow)
    }

    useTelemetry()?.trackWorkflowSaved({ is_app: isApp, is_new: true })
    return true
  }

  /**
   * Save a workflow
   * @param workflow The workflow to save
   */
  const saveWorkflow = async (workflow: ComfyWorkflow) => {
    if (workflow.isTemporary) {
      await saveWorkflowAs(workflow)
    } else {
      workflow.changeTracker?.checkState()

      const isApp = workflow.initialMode === 'app'
      const expectedPath =
        workflow.directory +
        '/' +
        appendWorkflowJsonExt(workflow.filename, isApp)
      if (workflow.path !== expectedPath) {
        const existing = workflowStore.getWorkflowByPath(expectedPath)
        if (existing && !existing.isTemporary) {
          if ((await confirmOverwrite(expectedPath)) !== true) {
            await workflowStore.saveWorkflow(workflow)
            return
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
    }
  }

  /**
   * Load the default workflow
   */
  const loadDefaultWorkflow = async () => {
    await app.loadGraphData(defaultGraph)
  }

  /**
   * Load a blank workflow
   */
  const loadBlankWorkflow = async () => {
    await app.loadGraphData(blankGraph)
  }

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
   */
  const openWorkflow = async (
    workflow: ComfyWorkflow,
    options: { force: boolean } = { force: false }
  ) => {
    if (workflowStore.isActive(workflow) && !options.force) return

    const loadFromRemote = !workflow.isLoaded
    if (loadFromRemote) {
      await workflow.load()
    }

    await app.loadGraphData(
      toRaw(workflow.activeState) as ComfyWorkflowJSON,
      /* clean=*/ true,
      /* restore_view=*/ true,
      workflow,
      {
        showMissingModels: loadFromRemote,
        showMissingNodes: true,
        checkForRerouteMigration: false,
        deferWarnings: true
      }
    )
    showPendingWarnings()
  }

  /**
   * Close a workflow with confirmation if there are unsaved changes
   * @param workflow The workflow to close
   * @returns true if the workflow was closed, false if the user cancelled
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
        hint: options.hint
      })
      // Cancel
      if (confirmed === null) return false

      if (confirmed === true) {
        await saveWorkflow(workflow)
      }
    }

    workflowDraftStore.removeDraft(workflow.path)

    // If this is the last workflow, create a new default temporary workflow
    if (workflowStore.openWorkflows.length === 1) {
      await loadDefaultWorkflow()
    }
    // If this is the active workflow, load the most recent workflow from history
    if (workflowStore.isActive(workflow)) {
      const mostRecentWorkflow = workflowStore.getMostRecentWorkflow()
      if (mostRecentWorkflow) {
        await openWorkflow(mostRecentWorkflow)
      } else {
        // Fallback to next workflow if no history
        await loadNextOpenedWorkflow()
      }
    }

    await workflowStore.closeWorkflow(workflow)
    return true
  }

  const renameWorkflow = async (workflow: ComfyWorkflow, newPath: string) => {
    await workflowStore.renameWorkflow(workflow, newPath)
  }

  /**
   * Delete a workflow
   * @param workflow The workflow to delete
   * @returns `true` if the workflow was deleted, `false` if the user cancelled
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
  const beforeLoadNewGraph = () => {
    // Use workspaceStore here as it is patched in unit tests.
    const workflowStore = useWorkspaceStore().workflow
    const activeWorkflow = workflowStore.activeWorkflow
    if (activeWorkflow) {
      activeWorkflow.changeTracker.store()
      if (settingStore.get('Comfy.Workflow.Persist') && activeWorkflow.path) {
        const activeState = activeWorkflow.activeState
        if (activeState) {
          try {
            const workflowJson = JSON.stringify(activeState)
            const saved = workflowDraftStore.saveDraft(
              activeWorkflow.path,
              workflowJson,
              {
                name: activeWorkflow.key,
                isTemporary: activeWorkflow.isTemporary
              }
            )

            if (!saved) {
              toastStore.add({
                severity: 'error',
                summary: t('g.error'),
                detail: t('toastMessages.failedToSaveDraft')
              })
            }
          } catch {
            toastStore.add({
              severity: 'error',
              summary: t('g.error'),
              detail: t('toastMessages.failedToSaveDraft')
            })
          }
        }
      }
      // Capture thumbnail before loading new graph
      void workflowThumbnail.storeThumbnail(activeWorkflow)
      domWidgetStore.clear()
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
    workflowData: ComfyWorkflowJSON
  ) => {
    const workflowStore = useWorkspaceStore().workflow
    const { isAppMode } = useAppMode()
    const wasAppMode = isAppMode.value

    // Determine the initial app mode for fresh loads from serialized state.
    // null means linearMode was never explicitly set (not builder-saved).
    const freshLoadMode = linearModeToAppMode(workflowData.extra?.linearMode)

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
        const isSameActiveWorkflowLoad =
          !!existingWorkflow &&
          workflowStore.isActive(existingWorkflow) &&
          (existingWorkflow.activeState?.id === undefined ||
            workflowData.id === undefined ||
            existingWorkflow.activeState.id === workflowData.id)

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
          loadedWorkflow.changeTracker.reset(workflowData)
          loadedWorkflow.changeTracker.restore()
          return
        }
      }

      const tempWorkflow = workflowStore.createNewTemporary(
        path ? appendJsonExt(path) : undefined,
        workflowData
      )
      tempWorkflow.initialMode = freshLoadMode
      trackIfEnteringApp(tempWorkflow)
      await workflowStore.openWorkflow(tempWorkflow)
      return
    }

    const loadedWorkflow = await workflowStore.openWorkflow(value)
    if (loadedWorkflow.initialMode === undefined) {
      loadedWorkflow.initialMode = freshLoadMode
      trackIfEnteringApp(loadedWorkflow)
    }
    loadedWorkflow.changeTracker.reset(workflowData)
    loadedWorkflow.changeTracker.restore()
  }

  /**
   * Insert the given workflow into the current graph editor.
   */
  const insertWorkflow = async (
    workflow: ComfyWorkflow,
    options: { position?: Point } = {}
  ) => {
    const loadedWorkflow = await workflow.load()
    const workflowJSON = toRaw(loadedWorkflow.initialState)
    const old = localStorage.getItem('litegrapheditor_clipboard')
    // unknown conversion: ComfyWorkflowJSON is stricter than LiteGraph's
    // serialisation schema.
    const graph = new LGraph(workflowJSON as unknown as SerialisableGraph)
    const canvasElement = document.createElement('canvas')
    const canvas = new LGraphCanvas(canvasElement, graph, {
      skip_events: true,
      skip_render: true
    })
    canvas.selectItems()
    canvas.copyToClipboard()
    app.canvas.pasteFromClipboard(options)
    if (old !== null) {
      localStorage.setItem('litegrapheditor_clipboard', old)
    }
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

    await app.loadGraphData(state, true, true, filename)
  }

  /**
   * Show and clear any pending warnings (missing nodes/models) stored on the
   * active workflow. Called after a workflow becomes visible so dialogs don't
   * overlap with subsequent loads.
   */
  function showPendingWarnings(workflow?: ComfyWorkflow | null) {
    const wf = workflow ?? workflowStore.activeWorkflow
    if (!wf?.pendingWarnings) return

    const { missingNodeTypes } = wf.pendingWarnings
    wf.pendingWarnings = null

    if (missingNodeTypes?.length) {
      executionErrorStore.surfaceMissingNodes(missingNodeTypes)
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
