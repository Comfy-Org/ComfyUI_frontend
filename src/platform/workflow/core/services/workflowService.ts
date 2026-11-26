import { insertItems } from '@/core/graph/clipboard/graphTransfer'
import { toRaw } from 'vue'

import { downloadBlob } from '@/base/common/downloadUtil'
import { t } from '@/i18n'
import { showDraftSaveFailedToast } from '@/platform/workflow/persistence/draftSaveFailureToast'
import type { PointTuple as Point } from '@comfyorg/shared-frontend-utils/geometry'
import type { LGraph } from '@/lib/litegraph/src/litegraph'
import { useSettingStore } from '@/platform/settings/settingStore'
import { useToast } from '@/components/ui/toast/toastStore'
import { createToastId } from '@/types/toastId'
import type { ToastId } from '@/types/toastId'
import {
  normalizePendingWarnings,
  updatePendingWarnings
} from '@/platform/workflow/core/utils/pendingWarnings'
import { workflowToClipboardItems } from '@/core/graph/clipboard/workflowToClipboardItems'
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
import {
  reportWorkflowStateAnomaly,
  UnreadableWorkflowError
} from '@/platform/workflow/management/stores/comfyWorkflow'
import { useTelemetry } from '@comfyorg/telemetry'
import type {
  ClipboardItems,
  SerialisableGraph
} from '@comfyorg/graph-model/serialisation'
import type { ComfyWorkflowJSON } from '@comfyorg/graph-model/workflowSchema'
// oxlint-disable-next-line comfy/no-restricted-paths
import { useWorkflowThumbnail } from '@/renderer/core/thumbnail/useWorkflowThumbnail'
import { useApp } from '@/scripts/appInstance'
import {
  bindCanvasTracker,
  invalidateCanvasTracker,
  isCanvasCaptureBlocked,
  isCanvasOwner
} from '@/platform/workflow/core/canvasTrackerOwnership'
import { getDefaultWorkflow } from '@/platform/workflow/core/services/defaultWorkflowService'
import { ChangeTracker } from '@/scripts/changeTracker'
import { blankGraph } from '@/scripts/defaultGraph'
import { useDialogService } from '@/services/dialogService'
import { useExtensionService } from '@/platform/extensions/services/extensionService'
import {
  graphsAwaitingNodeTypes,
  nodeTypesMayStillArrive
} from '@/platform/customNodes/lateLoading/lateNodeTypes'
import { showPlaceholdersAsWaiting } from '@/platform/customNodes/lateLoading/waitingNodes'
import { useAppMode } from '@/composables/useAppMode'
import { useAppModeStore } from '@/stores/appModeStore'
import { useExecutionErrorStore } from '@/stores/executionErrorStore'
import { presentRootGraph } from '@/platform/workflow/core/services/presentRootGraph'
import { useNodeOutputStore } from '@/stores/nodeOutputStore'
import {
  provideWorkflowService,
  useSubgraphNavigationStore
} from '@/stores/subgraphNavigationStore'
import { reportError } from '@comfyorg/telemetry/reportError'
import { UserDataExistsError } from '@comfyorg/api-client/ComfyApi'
import { useDeprecatedNodesStore } from '@/platform/workflowErrors/nodeReplacement/deprecatedNodesStore'
import { useMissingNodesErrorStore } from '@/platform/workflowErrors/nodeReplacement/missingNodesErrorStore'
import { useMissingModelStore } from '@/platform/workflowErrors/missingModel/missingModelStore'
import { useMissingMediaStore } from '@/platform/workflowErrors/missingMedia/missingMediaStore'
import { showMissingNodesNotice } from '@/platform/workflowErrors/nodeReplacement/missingNodesNotice'
import type { WorkflowOpening } from '@/platform/workflowErrors/nodeReplacement/types'
import { useWorkspaceStore } from '@/stores/workspaceStore'
import {
  appendJsonExt,
  appendWorkflowJsonExt,
  generateUUID
} from '@/utils/formatUtil'
import type { AppMode } from '@comfyorg/graph-model/appMode'
import type { UUID } from '@/utils/uuid'
import { zeroUuid } from '@comfyorg/graph-model/uuid'
import { ensureNonZeroUuid } from '@/utils/uuid'
import { insertPngTextChunk } from '@comfyorg/mask-editor/pngEncodeUtil'

export type WorkflowImageRender =
  | { ok: true; image: Blob }
  | { ok: false; cause?: unknown }

export function readWorkflowDraftLineage(path: string) {
  return useWorkflowDraftStoreV2().getDraft(path)?.lineage ?? null
}

export function writeWorkflowDraftLineage(
  path: string,
  lineage: { workflowId: string; lineageSeq: number }
): void {
  useWorkflowDraftStoreV2().setLineage(path, lineage)
}

function linearModeToAppMode(linearMode: unknown): AppMode | null {
  if (typeof linearMode !== 'boolean') return null
  return linearMode ? 'app' : 'graph'
}

function adoptRootGraphId(
  workflowData: ComfyWorkflowJSON,
  graph: LGraph
): UUID {
  if (graph.id === zeroUuid) {
    workflowData.id = ensureNonZeroUuid(graph)
  }
  return graph.id
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

/**
 * The id to fall back to when incoming workflow data carries none.
 *
 * Deliberately takes `ComfyWorkflow` rather than `LoadedComfyWorkflow`:
 * `LoadedComfyWorkflow` declares `activeState` non-null, but it is produced by
 * an unchecked `this as this & LoadedComfyWorkflow` cast over a getter that
 * still returns `this.changeTracker?.activeState ?? null`. Reading through the
 * nullable base contract is what makes the optional chain honest rather than
 * redundant. Returning `undefined` is safe: `ensureWorkflowId` generates a
 * fresh UUID for an absent or invalid fallback.
 *
 * Without this, activation threw `TypeError: Cannot read properties of null
 * (reading 'id')` (SEN-5, Sentry CLOUD-FRONTEND-PROD-1MB) — and it threw even
 * when the incoming data already had a valid id, because the argument is
 * evaluated before `ensureWorkflowId` can ignore it.
 */
function activeStateFallbackId(workflow: ComfyWorkflow): string | undefined {
  return workflow.activeState?.id
}

/**
 * Resets the tracker of a workflow that `openWorkflow` just activated and
 * restores its view state. Typed against `ComfyWorkflow` for the same reason as
 * `activeStateFallbackId`: `LoadedComfyWorkflow` promises a tracker the
 * unchecked cast cannot guarantee. Returns false (after reporting) when the
 * workflow has none, so the caller skips the reset instead of throwing.
 */
function resetAndRestoreTracker(
  workflow: ComfyWorkflow,
  workflowData: ComfyWorkflowJSON,
  isActive: boolean
): boolean {
  const tracker = workflow.changeTracker
  if (!tracker) {
    reportWorkflowStateAnomaly(
      'Activated workflow has no change tracker',
      'activateLoadedWorkflow.resetTracker',
      workflow,
      { isActive }
    )
    return false
  }
  const saved =
    workflow.isPersisted && workflow.isModified
      ? captureSavedBaseline(workflow)
      : undefined
  tracker.reset(ensureWorkflowId(workflowData, activeStateFallbackId(workflow)))
  try {
    tracker.restore()
  } finally {
    if (saved) restoreSavedBaseline(workflow, saved)
  }
  return true
}

interface SavedBaseline {
  state: ComfyWorkflowJSON | undefined
  content: string | null | undefined
}

function captureSavedBaseline(workflow: ComfyWorkflow): SavedBaseline {
  return {
    state: workflow.changeTracker?.initialState,
    content: workflow.originalContent
  }
}

function restoreSavedBaseline(
  workflow: ComfyWorkflow,
  saved: SavedBaseline
): void {
  const tracker = workflow.changeTracker
  if (
    tracker &&
    saved.state &&
    Array.isArray(saved.state.nodes) &&
    tracker.initialState !== saved.state &&
    workflow.originalContent === saved.content
  ) {
    tracker.initialState = saved.state
    workflow.isModified = !ChangeTracker.graphEqual(
      saved.state,
      tracker.activeState
    )
  }
}

async function keepingSavedBaseline<T>(
  workflow: ComfyWorkflow,
  load: () => Promise<T>
): Promise<T> {
  const saved = captureSavedBaseline(workflow)
  try {
    return await load()
  } finally {
    restoreSavedBaseline(workflow, saved)
  }
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
      reportError(error, {
        surface: 'graph',
        errorType: 'workflow_load_failure'
      })
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

const unreadableWorkflowToastIds = new Map<string, ToastId>()
const unreadableWorkflows = new WeakSet<ComfyWorkflow>()

/** Whether opening this workflow failed because its stored file is unreadable. */
export function isUnreadableWorkflow(workflow: ComfyWorkflow): boolean {
  return unreadableWorkflows.has(workflow)
}

/** Why openWorkflow resolved false; set on the caller's `failure` option. */
export type OpenWorkflowFailure =
  | 'superseded'
  | 'closing'
  | 'unreadable'
  | 'load_skipped'
  | 'load_failed'

export const useWorkflowService = () => {
  const settingStore = useSettingStore()
  const workflowStore = useWorkflowStore()
  const toast = useToast()
  const dialogService = useDialogService()
  const workflowThumbnail = useWorkflowThumbnail()
  const missingNodesErrorStore = useMissingNodesErrorStore()
  const workflowDraftStore = useWorkflowDraftStoreV2()

  const persistActiveWorkflowDraft = (activeWorkflow: ComfyWorkflow) => {
    if (!settingStore.get('Comfy.Workflow.Persist') || !activeWorkflow.path) {
      return
    }

    const activeState = activeWorkflow.activeState
    if (!activeState) return

    const savedState = activeWorkflow.changeTracker?.initialState
    try {
      if (
        activeWorkflow.isPersisted &&
        !activeWorkflow.isModified &&
        savedState &&
        ChangeTracker.graphEqual(savedState, activeState)
      ) {
        workflowDraftStore.removeDraft(activeWorkflow.path)
        return
      }

      const saved = workflowDraftStore.saveDraft(
        activeWorkflow.path,
        JSON.stringify(activeState),
        {
          name: activeWorkflow.key,
          isTemporary: activeWorkflow.isTemporary
        },
        { minUpdatedAt: activeWorkflow.lastModified }
      )

      if (!saved) {
        showDraftSaveFailedToast()
      }
    } catch (err) {
      console.error('Failed to persist active workflow draft', err)
      showDraftSaveFailedToast()
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

  async function saveNewWorkflowFile(
    workflow: ComfyWorkflow,
    path: string
  ): Promise<boolean> {
    try {
      await workflowStore.saveWorkflow(workflow)
      return true
    } catch (error) {
      if (!(error instanceof UserDataExistsError)) throw error
    }
    if ((await confirmOverwrite(path)) !== true) return false
    if (workflow.path !== path) return false
    await workflowStore.saveWorkflow(workflow, { overwrite: true })
    return true
  }

  async function getFilename(
    defaultName: string,
    extension = '.json'
  ): Promise<string | null> {
    if (settingStore.get('Comfy.PromptFilename')) {
      let filename = await dialogService.prompt({
        title: t('workflowService.exportWorkflow'),
        message: t('workflowService.enterFilenamePrompt'),
        defaultValue: defaultName
      })
      if (!filename) return null
      if (!filename.toLowerCase().endsWith(extension)) {
        filename += extension
      }
      return filename
    }
    return defaultName
  }

  function addViewRestore(
    workflow: Pick<ComfyWorkflowJSON | SerialisableGraph, 'extra'>
  ) {
    if (!settingStore.get('Comfy.EnableWorkflowViewRestore')) return

    const { offset, scale } = useApp().canvas.ds
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
    const p = await useApp().graphToPrompt()

    addViewRestore(p.workflow)
    const json = JSON.stringify(p[promptProperty], null, 2)
    const blob = new Blob([json], { type: 'application/json' })
    const file = await getFilename(filename)
    if (!file) return
    downloadBlob(file, blob)
  }

  function lostUnsavedEdits(workflow: ComfyWorkflow): boolean {
    return (
      workflow.isPersisted &&
      workflow.isModified &&
      workflow.content === workflow.originalContent
    )
  }

  async function loadForSave(workflow: ComfyWorkflow): Promise<boolean> {
    if (workflow.isLoaded || workflowStore.isActive(workflow)) return true
    await loadWorkflowInBackground(workflow)
    if (!lostUnsavedEdits(workflow)) return true
    reportWorkflowStateAnomaly(
      'Modified saved workflow lost its edits before saving',
      'workflowService.loadForSave',
      workflow
    )
    workflow.isModified = false
    toast.warning(t('workflowService.unsavedChangesLostTitle'), {
      description: t('workflowService.unsavedChangesLost', {
        name: workflow.filename
      })
    })
    return false
  }

  async function exportWorkflowImage(
    filename: string,
    renderImage: () => Promise<WorkflowImageRender>
  ): Promise<void> {
    const workflow = workflowStore.activeWorkflow
    if (workflow?.path) {
      filename = workflow.filename
    }
    const file = await getFilename(`${filename}.png`, '.png')
    if (!file) return

    let json = ''
    let render: WorkflowImageRender
    try {
      const app = useApp()
      const graph = app.rootGraph
      const activeGraph = app.canvas.graph
      const snapshot = graph.serialize()
      addViewRestore(snapshot)
      json = JSON.stringify(snapshot)
      const version = graph._version
      const rendering = renderImage()
      const unchanged =
        app.rootGraph === graph &&
        app.canvas.graph === activeGraph &&
        graph._version === version
      render = await rendering
      if (!unchanged) render = { ok: false }
    } catch (cause) {
      render = { ok: false, cause }
    }
    if (!render.ok) {
      if (render.cause !== undefined)
        reportError(render.cause, {
          surface: 'graph',
          errorType: 'error_rendering_workflow_image'
        })
      toast.error(t('g.error'), {
        description: t('toastMessages.failedToExportWorkflowImage')
      })
      return
    }
    downloadBlob(file, await insertPngTextChunk(render.image, 'workflow', json))
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
    if (!(await loadForSave(workflow))) return false

    const isApp = options.isApp ?? workflow.initialMode === 'app'
    const newPath =
      workflow.directory + '/' + appendWorkflowJsonExt(newFilename, isApp)
    const existingWorkflow = workflowStore.getWorkflowByPath(newPath)

    const occupiedByOther =
      existingWorkflow !== null && toRaw(existingWorkflow) !== toRaw(workflow)

    if (existingWorkflow?.isTemporary && occupiedByOther) {
      toast.error(t('g.error'), {
        description: t('workflowService.pathInUse', { path: newPath })
      })
      return false
    }

    const isSelfOverwrite =
      existingWorkflow !== null &&
      !occupiedByOther &&
      !existingWorkflow.isTemporary

    if (existingWorkflow && !existingWorkflow.isTemporary) {
      if ((await confirmOverwrite(newPath)) !== true) return false

      const stillTarget = () => {
        const current = workflowStore.getWorkflowByPath(newPath)
        return current !== null && toRaw(current) === toRaw(existingWorkflow)
      }
      if (!stillTarget() || existingWorkflow.path !== newPath) return false
      if (!isSelfOverwrite) {
        const deleted = await deleteWorkflow(existingWorkflow, true, {
          stillTarget
        })
        if (!deleted) return false
      }
    }

    if (isSelfOverwrite) {
      workflow.changeTracker?.prepareForSave()
      await workflowStore.saveWorkflow(workflow)
    } else {
      let target: ComfyWorkflow
      if (workflow.isTemporary) {
        if (!(await renameWorkflow(workflow, newPath))) return false
        target = workflow
      } else {
        target = workflowStore.saveAs(workflow, newPath)
        await openWorkflow(target)
      }

      if (options.isApp !== undefined) {
        useApp().rootGraph.extra.linearMode = isApp
        target.initialMode = isApp ? 'app' : 'graph'
      }
      target.changeTracker?.prepareForSave()
      if (!(await saveNewWorkflowFile(target, newPath))) return false
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

    if (!(await loadForSave(workflow))) return true
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
      if (!(await renameWorkflow(workflow, expectedPath))) {
        await workflowStore.saveWorkflow(workflow)
        return true
      }
      toast.info(
        t(
          isApp
            ? 'workflowService.savedAsApp'
            : 'workflowService.savedAsWorkflow'
        ),
        { duration: 3000 }
      )
    }

    await workflowStore.saveWorkflow(workflow)
    useTelemetry()?.trackWorkflowSaved({ is_app: isApp, is_new: false })
    return true
  }

  /**
   * Load the default workflow
   */
  const loadDefaultWorkflow = async (options: { initiator?: 'user' } = {}) => {
    return queueWorkflowLoad(() =>
      useApp().loadGraphData(getDefaultWorkflow(), true, true, null, options)
    )
  }

  /**
   * Load a blank workflow
   */
  const loadBlankWorkflow = async (options: { initiator?: 'user' } = {}) => {
    const loaded = await queueWorkflowLoad(() =>
      useApp().loadGraphData(blankGraph)
    )
    const activatedWorkflow = typeof loaded === 'object' ? loaded : undefined
    if (
      options.initiator === 'user' &&
      activatedWorkflow !== undefined &&
      workflowStore.isActive(activatedWorkflow)
    )
      workflowStore.reportUserActivation(activatedWorkflow)
    return loaded
  }

  const reloadCurrentWorkflow = async () => {
    await workflowLoadTail
    const workflow = workflowStore.activeWorkflow
    if (workflow) {
      await openWorkflow(workflow, {
        force: true,
        isCurrent: () => workflowStore.activeWorkflow === workflow,
        keepSavedBaseline: true
      })
    }
  }

  const restoreRetainedWorkflow = async (failed?: ComfyWorkflow) => {
    const retained = getActiveWorkflow()
    if (!retained || retained.path === failed?.path || !retained.isLoaded)
      return

    const canvasAwaitsRetained = () =>
      workflowStore.isActive(retained) &&
      !(retained.changeTracker && isCanvasOwner(retained.changeTracker))
    if (!canvasAwaitsRetained()) return
    if (
      !retained.graph ||
      !(await switchToWorkflowGraph(
        retained,
        retained.graph,
        undefined,
        canvasAwaitsRetained
      ))
    ) {
      const load = () =>
        useApp().loadGraphData(
          toRaw(retained.activeState) as ComfyWorkflowJSON,
          true,
          true,
          retained,
          {
            checkForRerouteMigration: false,
            deferWarnings: true,
            skipAssetScans: true,
            isCurrent: canvasAwaitsRetained
          }
        )
      await (retained.isModified
        ? keepingSavedBaseline(retained, load)
        : load())
    }
    showPendingWarnings(undefined, { silent: true })
  }

  function getActiveWorkflow(): ComfyWorkflow | null {
    return workflowStore.activeWorkflow
  }

  // A superseded open leaves the workflow as it found it. A saved file drops
  // what it fetched, including a draft's modified mark, so a later save cannot
  // write an empty graph; a temporary one has no remote copy to refetch, so it
  // keeps its content, as closing it does.
  function discardSupersededLoad(
    workflow: ComfyWorkflow,
    wasModified: boolean
  ): void {
    if (workflow.isTemporary) return
    workflow.unload()
    workflow.isModified = wasModified
  }

  const switchToWorkflowGraph = (
    workflow: ComfyWorkflow,
    graph: NonNullable<ComfyWorkflow['graph']>,
    navigationIntentId?: number,
    isCurrent?: () => boolean
  ): Promise<boolean> =>
    useApp().enqueueGraphLoad(async () => {
      if (
        isCurrent?.() === false ||
        workflow.graph !== graph ||
        graphsAwaitingNodeTypes.has(graph)
      )
        return false
      await useExtensionService().invokeExtensionsAsync('beforeLoadGraph')
      if (
        isCurrent?.() === false ||
        workflow.graph !== graph ||
        graphsAwaitingNodeTypes.has(graph)
      ) {
        await useExtensionService().invokeExtensionsAsync(
          'onGraphLoadError',
          new DOMException('Workflow load was replaced', 'AbortError')
        )
        return false
      }
      try {
        beforeLoadNewGraph(true)()
        const app = useApp()
        presentRootGraph(app, graph, { clean: true, skipAssetScans: true })
        missingNodesErrorStore.setMissingNodeTypes([])
        const loaded = await workflowStore.openWorkflow(workflow)
        bindCanvasTracker(loaded.changeTracker)
        useExecutionErrorStore().setActiveGraph(graph.id, loaded.path)
        useAppModeStore().loadSelections(loaded.activeState.extra?.linearData)
        loaded.changeTracker.restore()
        useNodeOutputStore().restorePreviewsForWorkflow(loaded.path)
        await useExtensionService().invokeExtensionsAsync('afterLoadGraph')
        requestAnimationFrame(() => {
          app.canvas.setDirty(true, true)
        })
        return true
      } finally {
        void useSubgraphNavigationStore().updateHash(
          'workflow-load',
          navigationIntentId
        )
      }
    })

  const loadWorkflowState = async (
    workflow: ComfyWorkflow,
    options: {
      keepSavedBaseline?: boolean
      isCurrent?: () => boolean
      loadFromRemote: boolean
      wasModified: boolean
    },
    skipAssetScans: boolean,
    navigationIntentId: number,
    attempt: { skipped: boolean }
  ) => {
    const { isCurrent } = options
    const reloadsCanvas = workflowStore.isActive(workflow)
    let saved: SavedBaseline | undefined
    const snapshot = () => {
      workflow.changeTracker?.prepareForSave()
      saved =
        options.keepSavedBaseline && workflow.isModified
          ? captureSavedBaseline(workflow)
          : undefined
      return toRaw(workflow.activeState) as ComfyWorkflowJSON | undefined
    }
    const queued = snapshot()
    const snapshotAtTurn = () => {
      const data = snapshot()
      if (!data) attempt.skipped = true
      return data
    }
    const readyAtTurn = () => {
      const ready = workflowStore.isActive(workflow) && isCurrent?.() !== false
      if (!ready) attempt.skipped = true
      return ready
    }
    const loadAtTurn = async () => {
      try {
        return await useApp().loadGraphData(queued, true, true, workflow, {
          checkForRerouteMigration: false,
          deferWarnings: true,
          skipAssetScans,
          workflowNavigationId: navigationIntentId,
          isCurrent: reloadsCanvas ? undefined : isCurrent,
          ...(reloadsCanvas && {
            isReady: readyAtTurn,
            resolveGraphData: snapshotAtTurn
          })
        })
      } finally {
        if (saved && !attempt.skipped) restoreSavedBaseline(workflow, saved)
      }
    }
    const loaded = await loadAtTurn()
    if (loaded === false && options.loadFromRemote && isCurrent?.() === false)
      discardSupersededLoad(workflow, options.wasModified)
    return loaded
  }

  const completeActivation = (
    workflow: ComfyWorkflow,
    initiator: 'user' | undefined,
    silent: boolean,
    opening: WorkflowOpening = 'reopened'
  ) => {
    showPendingWarnings(undefined, { silent, opening })
    if (initiator === 'user') workflowStore.reportUserActivation(workflow)
  }

  /**
   * Opens a workflow in the current workspace, resolving false when the graph
   * load failed or the open was skipped.
   */
  const openWorkflow = (
    workflow: ComfyWorkflow,
    options: {
      force?: boolean
      navigationIntentId?: number
      isCurrent?: () => boolean
      initiator?: 'user'
      keepSavedBaseline?: boolean
      opening?: WorkflowOpening
      /** Receives the reason when the open resolves false. */
      failure?: { reason?: OpenWorkflowFailure }
    } = {}
  ): Promise<boolean> => {
    const fail = (reason: OpenWorkflowFailure) => {
      if (options.failure) options.failure.reason = reason
      return false
    }
    if (options.isCurrent?.() === false)
      return Promise.resolve(fail('superseded'))
    if (closingWorkflowCounts.has(closingKey(workflow)))
      return Promise.resolve(fail('closing'))
    if (
      pendingWorkflowLoads === 0 &&
      workflowStore.isActive(workflow) &&
      !(workflow.graph && graphsAwaitingNodeTypes.has(workflow.graph)) &&
      workflow.changeTracker !== null &&
      isCanvasOwner(workflow.changeTracker) &&
      !options.force
    ) {
      if (options.initiator === 'user')
        workflowStore.reportUserActivation(workflow)
      return Promise.resolve(true)
    }

    const navigationIntentId =
      options.navigationIntentId ??
      useSubgraphNavigationStore().beginWorkflowNavigation()
    return queueWorkflowLoad(async () => {
      let wasUnreadable = false
      try {
        if (options.isCurrent?.() === false) {
          useSubgraphNavigationStore().endWorkflowNavigation(navigationIntentId)
          return fail('superseded')
        }
        wasUnreadable = unreadableWorkflows.delete(workflow)

        if (
          workflow.graph &&
          !options.force &&
          (await switchToWorkflowGraph(
            workflow,
            workflow.graph,
            navigationIntentId
          ))
        ) {
          completeActivation(workflow, options.initiator, true, options.opening)
          return true
        }

        const loadFromRemote = !workflow.isLoaded
        const wasModified = workflow.isModified
        if (loadFromRemote) {
          await workflow.load()
        }
        if (options.isCurrent?.() === false) {
          if (loadFromRemote) discardSupersededLoad(workflow, wasModified)
          useSubgraphNavigationStore().endWorkflowNavigation(navigationIntentId)
          return fail('superseded')
        }

        const reusesScans = !loadFromRemote && !options.force
        const attempt = { skipped: false }
        const loaded = await loadWorkflowState(
          workflow,
          { ...options, loadFromRemote, wasModified },
          reusesScans,
          navigationIntentId,
          attempt
        )
        if (loaded === false) {
          useSubgraphNavigationStore().endWorkflowNavigation(navigationIntentId)
          if (attempt.skipped)
            return fail(
              options.isCurrent?.() === false ? 'superseded' : 'load_skipped'
            )
          if (options.isCurrent?.() === false) {
            await restoreRetainedWorkflow(workflow)
            return fail('superseded')
          }
          await restoreRetainedWorkflow(workflow)
          return fail('load_failed')
        }
        dismissUnreadableWorkflowToast(workflow)
        completeActivation(
          workflow,
          options.initiator,
          reusesScans,
          options.opening
        )
        return true
      } catch (error) {
        useSubgraphNavigationStore().endWorkflowNavigation(navigationIntentId)
        if (error instanceof UnreadableWorkflowError) {
          if (options.isCurrent?.() === false) return fail('superseded')
          markUnreadable(workflow)
          return fail('unreadable')
        }
        throw error
      } finally {
        if (wasUnreadable && !isUnreadableWorkflow(workflow))
          dismissUnreadableWorkflowToast(workflow)
      }
    }, workflow.path)
  }

  const markUnreadable = (workflow: ComfyWorkflow) => {
    unreadableWorkflows.add(workflow)
    showUnreadableWorkflowToast(workflow)
  }

  const showUnreadableWorkflowToast = (workflow: ComfyWorkflow) => {
    const id = unreadableWorkflowToastIds.get(workflow.path) ?? createToastId()
    unreadableWorkflowToastIds.set(workflow.path, id)
    toast.error(t('workflowService.unreadableWorkflowTitle'), {
      id,
      description: t('workflowService.unreadableWorkflowMessage', {
        name: workflow.key
      }),
      ...(!workflow.isTemporary && {
        action: {
          label: t('g.delete'),
          onClick: async () => {
            const stillTarget = () =>
              isUnreadableWorkflow(workflow) &&
              workflowStore.getWorkflowByPath(workflow.path) === workflow
            const kept =
              stillTarget() &&
              !(await deleteWorkflow(workflow, false, { stillTarget })) &&
              stillTarget()
            if (kept) return
            dismissUnreadableWorkflowToast(workflow)
          }
        }
      })
    })
  }

  const dismissUnreadableWorkflowToast = (workflow: ComfyWorkflow) => {
    const id = unreadableWorkflowToastIds.get(workflow.path)
    if (id === undefined) return
    toast.dismiss(id)
    unreadableWorkflowToastIds.delete(workflow.path)
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
    options: {
      warnIfUnsaved: boolean
      hint?: string
      onReplacementOpened?: (workflow: ComfyWorkflow) => void
    } = {
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

      if (confirmed) {
        const saved = await saveWorkflow(workflow)
        if (!saved) return false
      }
    }

    const loadDefaultAsReplacement = async (): Promise<boolean> => {
      if ((await loadDefaultWorkflow()) === false) return false
      const opened = workflowStore.activeWorkflow
      if (opened) options.onReplacementOpened?.(opened)
      return true
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
          if (await openWorkflow(replacementWorkflow)) {
            options.onReplacementOpened?.(replacementWorkflow)
          } else if (
            !isUnreadableWorkflow(replacementWorkflow) ||
            !(await loadDefaultAsReplacement())
          ) {
            return false
          }
        } else {
          if (!(await loadDefaultAsReplacement())) return false
        }
      } else if (
        // Read live, post-drain: the awaits above can change the answer.
        workflowStore.openWorkflows.length > 0 &&
        workflowStore.openWorkflows.every((open) =>
          closingWorkflowCounts.has(closingKey(open))
        )
      ) {
        if (!(await loadDefaultAsReplacement())) return false
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

  /**
   * Loads an open tab without showing it, and sets its app/graph mode the way
   * opening it would.
   */
  const loadWorkflowInBackground = (
    workflow: ComfyWorkflow
  ): Promise<ComfyWorkflow> =>
    queueWorkflowLoad(async () => {
      const loaded: ComfyWorkflow = await workflow.load()
      if (loaded.initialMode === undefined)
        loaded.initialMode =
          linearModeToAppMode(loaded.initialState?.extra?.linearMode) ??
          linearModeToAppMode(loaded.activeState?.extra?.linearMode)
      return loaded
    }, workflow.path)

  const renameWorkflow = async (
    workflow: ComfyWorkflow,
    newPath: string
  ): Promise<boolean> => {
    const oldPath = workflow.path
    const graphId = workflow.activeState?.id
    const result = await workflowStore.renameWorkflow(workflow, newPath)
    if (result === false) {
      toast.error(t('g.error'), {
        description: t('workflowService.pathInUse', { path: newPath })
      })
      return false
    }
    if (graphId) {
      useExecutionErrorStore().moveRunErrors(graphId, oldPath, workflow.path)
    }
    if (result === 'bookmarks-not-updated') {
      toast.warning(t('sideToolbar.workflowTab.renamedButBookmarksNotUpdated'))
    }
    return true
  }

  /**
   * Delete a workflow
   * @param workflow The workflow to delete
   * @param options.stillTarget Checked after each wait; `false` aborts
   * @returns `true` if the workflow was deleted; `false` if the user
   * cancelled, the target changed or the close was aborted by a failed
   * replacement load
   */
  const deleteWorkflow = async (
    workflow: ComfyWorkflow,
    silent = false,
    options: { stillTarget?: () => boolean } = {}
  ): Promise<boolean> => {
    const stillTarget = options.stillTarget ?? (() => true)
    const bypassConfirm = !settingStore.get('Comfy.Workflow.ConfirmDelete')
    let confirmed: boolean | null = bypassConfirm || silent

    if (!confirmed) {
      confirmed = await dialogService.confirm({
        title: t('sideToolbar.workflowTab.confirmDeleteTitle'),
        type: 'delete',
        message: t('sideToolbar.workflowTab.confirmDelete'),
        itemList: [workflow.path]
      })
      if (!confirmed || !stillTarget()) return false
    }

    if (workflowStore.isOpen(workflow)) {
      await closeWorkflows([workflow], {
        warnIfUnsaved: !confirmed,
        initiator: silent ? undefined : 'user'
      })
      if (workflowStore.isOpen(workflow)) return false
    }
    if (!stillTarget()) return false
    const unbookmarked = await workflowStore.deleteWorkflow(workflow)
    if (!unbookmarked) {
      toast.warning(t('sideToolbar.workflowTab.deletedButBookmarksNotUpdated'))
    } else if (!silent) {
      toast.info(t('sideToolbar.workflowTab.deleted'), { duration: 1000 })
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
    const workflowStore = useWorkspaceStore().workflow
    const activeWorkflow = workflowStore.activeWorkflow
    if (activeWorkflow) {
      if (!isCanvasCaptureBlocked()) {
        const tracker = (activeWorkflow as ComfyWorkflow).changeTracker
        if (tracker) {
          tracker.deactivate()
        } else {
          reportWorkflowStateAnomaly(
            'Active workflow has no change tracker before loading a new graph',
            'beforeLoadNewGraph',
            activeWorkflow,
            { isActive: true }
          )
        }
        persistActiveWorkflowDraft(activeWorkflow)
        const modelCandidates = useMissingModelStore().missingModelCandidates
        const mediaCandidates = useMissingMediaStore().missingMediaCandidates
        const nodeTypes = missingNodesErrorStore.missingNodesError?.nodeTypes
        updatePendingWarnings(activeWorkflow, {
          missingNodeTypes: nodeTypes?.length ? [...nodeTypes] : undefined,
          missingModelCandidates: modelCandidates ?? undefined,
          missingMediaCandidates: mediaCandidates ?? undefined
        })

        useNodeOutputStore().stashPreviewsForWorkflow(activeWorkflow.path)

        void workflowThumbnail.storeThumbnail(
          activeWorkflow,
          workflowStore.activeSubgraph || useApp().canvasOrUndefined?.graph
        )
      } else {
        useNodeOutputStore().addLivePreviewsToStash(activeWorkflow.path)
      }

      useSubgraphNavigationStore().saveCurrentViewport(suppressWorkflowReset)
    }
    return invalidateCanvasTracker
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
    graph: LGraph,
    shareId?: string
  ) => {
    await activateLoadedWorkflow(value, workflowData, graph, shareId)
    useNodeOutputStore().restorePreviewsForWorkflow(
      useWorkspaceStore().workflow.activeWorkflow?.path
    )
  }

  const activateLoadedWorkflow = async (
    value: string | ComfyWorkflow | null,
    workflowData: ComfyWorkflowJSON,
    graph: LGraph,
    shareId?: string
  ) => {
    const workflowStore = useWorkspaceStore().workflow
    const { isAppMode } = useAppMode()
    const wasAppMode = isAppMode.value
    const rootGraphId = adoptRootGraphId(workflowData, graph)

    function activateLoadedGraph(workflow: ComfyWorkflow) {
      useExecutionErrorStore().setActiveGraph(rootGraphId, workflow.path)
      workflow.adoptGraph(graph)
    }

    async function bindStoredToCanvas(workflow: ComfyWorkflow) {
      try {
        return await bindToCanvas(workflow)
      } catch (error) {
        if (!(error instanceof UnreadableWorkflowError)) throw error
        markUnreadable(workflow)
        return undefined
      }
    }

    async function bindToCanvas(workflow: ComfyWorkflow) {
      const loadedWorkflow = await workflowStore.openWorkflow(workflow)
      if (useApp().rootGraphOrUndefined !== graph) return null
      bindCanvasTracker(loadedWorkflow.changeTracker)
      activateLoadedGraph(loadedWorkflow)
      return loadedWorkflow
    }

    const freshLoadMode = linearModeToAppMode(workflowData.extra?.linearMode)
    useAppModeStore().loadSelections(workflowData.extra?.linearData)

    function trackIfEnteringApp(workflow: ComfyWorkflow) {
      if (!wasAppMode && workflow.initialMode === 'app') {
        useTelemetry()?.trackEnterLinear({ source: 'workflow' })
      }
    }

    if (value === null || typeof value === 'string') {
      if (value) {
        const fullPath = ComfyWorkflow.basePath + appendJsonExt(value)
        const existingWorkflow = workflowStore.getWorkflowByPath(fullPath)

        const existingId = existingWorkflow?.activeState?.id
        const isSameActiveWorkflowLoad =
          !!existingWorkflow &&
          workflowStore.isActive(existingWorkflow) &&
          (existingWorkflow.isTemporary ||
            areWorkflowIdsEquivalent(
              existingId,
              workflowData.id,
              existingWorkflow.legacyId
            ))

        const reused =
          existingWorkflow &&
          ((existingWorkflow.isPersisted && !existingWorkflow.isLoaded) ||
            isSameActiveWorkflowLoad)
            ? await bindStoredToCanvas(existingWorkflow)
            : undefined
        if (reused !== undefined) {
          const loadedWorkflow = reused
          if (!loadedWorkflow) return
          if (loadedWorkflow.initialMode === undefined) {
            const initialState = (loadedWorkflow as ComfyWorkflow).initialState
            if (!initialState) {
              reportWorkflowStateAnomaly(
                'Activated workflow has no initial state',
                'activateLoadedWorkflow.initialMode',
                loadedWorkflow,
                { isActive: workflowStore.isActive(loadedWorkflow) }
              )
            }
            loadedWorkflow.initialMode =
              linearModeToAppMode(initialState?.extra?.linearMode) ??
              freshLoadMode
            trackIfEnteringApp(loadedWorkflow)
          }
          if (shareId) {
            loadedWorkflow.shareId = shareId
          }
          loadedWorkflow.legacyId ??= getLegacyWorkflowId(workflowData.id)
          resetAndRestoreTracker(
            loadedWorkflow,
            workflowData,
            workflowStore.isActive(loadedWorkflow)
          )
          return
        }
      }

      const tempWorkflow = workflowStore.createNewTemporary(
        value ? appendJsonExt(value) : undefined,
        workflowData
      )
      tempWorkflow.initialMode = freshLoadMode
      if (shareId) {
        tempWorkflow.shareId = shareId
      }
      trackIfEnteringApp(tempWorkflow)
      await bindToCanvas(tempWorkflow)
      return
    }

    const loadedWorkflow = await bindToCanvas(value)
    if (!loadedWorkflow) return
    if (shareId) {
      loadedWorkflow.shareId = shareId
    }
    if (loadedWorkflow.initialMode === undefined) {
      loadedWorkflow.initialMode = freshLoadMode
      trackIfEnteringApp(loadedWorkflow)
    }
    loadedWorkflow.legacyId ??= getLegacyWorkflowId(workflowData.id)
    resetAndRestoreTracker(
      loadedWorkflow,
      workflowData,
      workflowStore.isActive(loadedWorkflow)
    )
  }

  const insertWorkflow = async (
    workflow: ComfyWorkflow,
    options: { position?: Point } = {}
  ) => {
    const canvas = useApp().canvas
    const graph = canvas.graph
    const loadedWorkflow = await workflow.load()
    if (useApp().canvas !== canvas || canvas.graph !== graph) {
      const replacementKind = useApp().canvas !== canvas ? 'canvas' : 'graph'
      reportError(
        new Error(
          'insertWorkflow aborted: canvas or graph was replaced while the workflow loaded'
        ),
        {
          surface: 'graph',
          errorType: 'workflow_insert_aborted_canvas_changed',
          level: 'warning',
          tags: {
            failure_kind: 'degraded',
            feature_area: 'workflow',
            operation: 'insert',
            outcome: 'degraded',
            assert_mode: 'soft'
          },
          context: { replacement_kind: replacementKind }
        }
      )
      return
    }
    const workflowJSON = toRaw(loadedWorkflow.initialState)
    let items: ClipboardItems
    try {
      items = workflowToClipboardItems(workflowJSON)
    } catch (error) {
      reportError(error, {
        surface: 'graph',
        errorType: 'workflow_insert_invalid_clipboard_data'
      })
      return false
    }
    insertItems(canvas, items, options)
  }

  const closeWorkflows = async (
    workflows: ComfyWorkflow[],
    {
      initiator,
      ...options
    }: { warnIfUnsaved: boolean; hint?: string; initiator?: 'user' }
  ): Promise<void> => {
    const opened: { replacement?: ComfyWorkflow } = {}
    const onReplacementOpened = (replacement: ComfyWorkflow) => {
      opened.replacement = replacement
    }
    try {
      for (const workflow of workflows)
        if (
          !(await closeWorkflow(workflow, { ...options, onReplacementOpened }))
        )
          break
    } finally {
      const { replacement } = opened
      if (
        initiator === 'user' &&
        replacement !== undefined &&
        workflowStore.isActive(replacement)
      )
        workflowStore.reportUserActivation(replacement)
    }
  }

  const loadNextOpenedWorkflow = async (
    options: { initiator?: 'user' } = {}
  ) => {
    const nextWorkflow = workflowStore.openedWorkflowIndexShift(1)
    if (nextWorkflow) {
      await openWorkflow(nextWorkflow, options)
    }
  }

  const loadPreviousOpenedWorkflow = async (
    options: { initiator?: 'user' } = {}
  ) => {
    const previousWorkflow = workflowStore.openedWorkflowIndexShift(-1)
    if (previousWorkflow) {
      await openWorkflow(previousWorkflow, options)
    }
  }

  /**
   * Takes an existing workflow and duplicates it with a new name
   */
  const duplicateWorkflow = async (
    workflow: ComfyWorkflow,
    options: { initiator?: 'user' } = {}
  ) => {
    if (!workflow.isLoaded) await workflow.load()
    const state = JSON.parse(JSON.stringify(workflow.activeState))
    // Ensure duplicates are always treated as distinct workflows.
    if (state) state.id = generateUUID()
    const suffix = workflow.isPersisted ? ' (Copy)' : ''
    // Remove the suffix `(2)` or similar
    const filename = workflow.filename.replace(/\s*\(\d+\)$/, '') + suffix
    const duplicate = workflowStore.createNewTemporary(
      appendJsonExt(filename),
      state
    )

    await queueWorkflowLoad(() =>
      useApp().loadGraphData(state, true, true, duplicate, options)
    )
  }

  /**
   * Shows the missing node, model and media warnings stored on a workflow (the
   * active one by default) and keeps them for later tab switches.
   */
  function showPendingWarnings(
    workflow?: ComfyWorkflow | null,
    options?: { silent?: boolean; opening?: WorkflowOpening }
  ) {
    const wf = workflow ?? workflowStore.activeWorkflow
    if (!wf) return

    const { missingNodeTypes, missingModelCandidates, missingMediaCandidates } =
      wf.pendingWarnings ?? {}

    const rootGraph = useApp().rootGraphOrUndefined
    useDeprecatedNodesStore().rescan(rootGraph)
    if (nodeTypesMayStillArrive()) {
      if (rootGraph) showPlaceholdersAsWaiting(rootGraph)
    } else if (
      missingNodesErrorStore.surfaceMissingNodes(missingNodeTypes ?? []) &&
      !options?.silent
    ) {
      showMissingNodesNotice(missingNodeTypes ?? [], options?.opening)
    }
    if (missingModelCandidates?.length) {
      useMissingModelStore().setMissingModels(missingModelCandidates)
    }
    if (missingMediaCandidates?.length) {
      useMissingMediaStore().setMissingMedia(missingMediaCandidates)
    }

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
    exportWorkflowImage,
    saveWorkflowAs,
    saveWorkflow,
    loadDefaultWorkflow,
    loadBlankWorkflow,
    reloadCurrentWorkflow,
    openWorkflow,
    loadWorkflowInBackground,
    closeWorkflow,
    closeWorkflows,
    renameWorkflow,
    deleteWorkflow,
    insertWorkflow,
    loadNextOpenedWorkflow,
    loadPreviousOpenedWorkflow,
    duplicateWorkflow,
    showPendingWarnings,
    afterLoadNewGraph,
    beforeLoadNewGraph,
    restoreRetainedWorkflow
  }
}

provideWorkflowService(useWorkflowService)
