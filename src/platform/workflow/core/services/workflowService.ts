import { toRaw, watch } from 'vue'

import { downloadBlob } from '@/base/common/downloadUtil'
import { t } from '@/i18n'
import type { PointTuple as Point } from '@comfyorg/shared-frontend-utils/geometry'
import type { SerialisableGraph } from '@/lib/litegraph/src/litegraph'
import { useSettingStore } from '@/platform/settings/settingStore'
import { useToast } from '@/components/ui/toast/toastStore'
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
import { reportWorkflowStateAnomaly } from '@/platform/workflow/management/stores/comfyWorkflow'
import { useTelemetry } from '@comfyorg/telemetry'
import type { LoadedComfyWorkflow } from '@/platform/workflow/management/stores/comfyWorkflow'
import type { ComfyWorkflowJSON } from '@comfyorg/graph-model/workflowSchema'
// oxlint-disable-next-line comfy/no-restricted-paths
import { useWorkflowThumbnail } from '@/renderer/core/thumbnail/useWorkflowThumbnail'
import { useApp } from '@/scripts/appInstance'
import { getDefaultWorkflow } from '@/platform/workflow/core/services/defaultWorkflowService'
import { ChangeTracker } from '@/scripts/changeTracker'
import { blankGraph } from '@/scripts/defaultGraph'
import {
  SavedFileIdentityError,
  sameUserFileScope
} from '@/platform/workflow/core/utils/userFileIdentity'
import {
  currentUserFileScope,
  isUserFileIdentityCurrent
} from '@/platform/workflow/core/services/userFileContext'
import { useDialogService } from '@/services/dialogService'
import { nodeTypesMayStillArrive } from '@/platform/customNodes/lateLoading/lateNodeTypes'
import { showPlaceholdersAsWaiting } from '@/platform/customNodes/lateLoading/waitingNodes'
import { useAppMode } from '@/composables/useAppMode'
import { useDomWidgetStore } from '@/stores/domWidgetStore'
import { useAppModeStore } from '@/stores/appModeStore'
import { useExecutionErrorStore } from '@/stores/executionErrorStore'
import { useNodeOutputStore } from '@/stores/nodeOutputStore'
import {
  provideWorkflowService,
  useSubgraphNavigationStore
} from '@/stores/subgraphNavigationStore'
import { reportError } from '@comfyorg/telemetry/reportError'
import { useMissingNodesErrorStore } from '@/platform/workflowErrors/nodeReplacement/missingNodesErrorStore'
import { useMissingModelStore } from '@/platform/workflowErrors/missingModel/missingModelStore'
import { useMissingMediaStore } from '@/platform/workflowErrors/missingMedia/missingMediaStore'
import { showMissingNodesNotice } from '@/platform/workflowErrors/nodeReplacement/missingNodesNotice'
import { useWorkspaceStore } from '@/stores/workspaceStore'
import {
  appendJsonExt,
  appendWorkflowJsonExt,
  generateUUID
} from '@/utils/formatUtil'
import type { AppMode } from '@comfyorg/graph-model/appMode'
import type { UUID } from '@/utils/uuid'
import { ensureNonZeroUuid, zeroUuid } from '@/utils/uuid'

type WorkflowActivationOptions = {
  shareId?: string
  isCurrent?: () => boolean
  onActivated?: (workflow: LoadedComfyWorkflow) => void
}

function watchSaveAsSource(workflow: ComfyWorkflow) {
  const currentScope = currentUserFileScope()
  const sourceScope = currentScope && { ...currentScope }
  const controller = new AbortController()
  const matchesScope = (scope: ReturnType<typeof currentUserFileScope>) =>
    sourceScope === null
      ? scope === null
      : sameUserFileScope(sourceScope, scope)
  const isCurrent = () =>
    !controller.signal.aborted &&
    matchesScope(currentUserFileScope()) &&
    isUserFileIdentityCurrent(workflow.savedFileIdentity)
  const stop = watch(
    currentUserFileScope,
    (scope) => {
      if (!matchesScope(scope))
        controller.abort(new SavedFileIdentityError('scope'))
    },
    { flush: 'sync' }
  )
  return { isCurrent, signal: controller.signal, stop }
}

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

/**
 * Returns the root graph id to scope run errors by, minting one when the graph
 * carries the zero id. Every caller passes `rootGraph.serialize()` as
 * `workflowData`, and `app.clean()` mints a fresh root id before `loadApiJson`
 * and `importA1111` populate the graph, so the zero id only survives here when
 * something upstream skipped both. The id is written back into `workflowData`
 * only in that zero-id case, so a `configure()`-based load (where
 * `rootGraph.id` already came from `workflowData.id`) can never have this
 * rewrite the incoming workflow's identity to a stale graph's id.
 */
function adoptRootGraphId(workflowData: ComfyWorkflowJSON): UUID | null {
  if (!useApp().isGraphReady) return null

  const rootGraph = useApp().rootGraph
  if (rootGraph.id === zeroUuid) {
    workflowData.id = ensureNonZeroUuid(rootGraph)
  }
  return rootGraph.id
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
  tracker.reset(ensureWorkflowId(workflowData, activeStateFallbackId(workflow)))
  tracker.restore()
  return true
}

async function keepingSavedBaseline<T>(
  workflow: ComfyWorkflow,
  load: () => Promise<T>
): Promise<T> {
  const savedState = workflow.changeTracker?.initialState
  const savedContent = workflow.originalContent
  try {
    return await load()
  } finally {
    const tracker = workflow.changeTracker
    if (tracker && savedState && workflow.originalContent === savedContent) {
      tracker.initialState = savedState
      workflow.isModified = !ChangeTracker.graphEqual(
        savedState,
        tracker.activeState
      )
    }
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

export const useWorkflowService = () => {
  const settingStore = useSettingStore()
  const workflowStore = useWorkflowStore()
  const toast = useToast()
  const dialogService = useDialogService()
  const workflowThumbnail = useWorkflowThumbnail()
  const domWidgetStore = useDomWidgetStore()
  const missingNodesErrorStore = useMissingNodesErrorStore()
  const workflowDraftStore = useWorkflowDraftStoreV2()

  const showFailedToSaveDraftToast = () => {
    toast.error(t('g.error'), {
      description: t('toastMessages.failedToSaveDraft')
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
          isTemporary: activeWorkflow.isTemporary,
          savedFileIdentity: activeWorkflow.savedFileIdentity
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
  async function prepareSaveAsDestination(
    workflow: ComfyWorkflow,
    newPath: string,
    operation: ReturnType<typeof watchSaveAsSource>
  ): Promise<'cancelled' | 'self' | 'copy'> {
    const existing = workflowStore.getWorkflowByPath(newPath)
    if (!existing || existing.isTemporary) return 'copy'
    const isSelfOverwrite = existing.path === workflow.path
    const confirmed = await confirmOverwrite(newPath)
    if (confirmed !== true || !operation.isCurrent()) return 'cancelled'
    if (isSelfOverwrite) return 'self'
    const deleted = await deleteWorkflow(existing, true, operation)
    return deleted && operation.isCurrent() ? 'copy' : 'cancelled'
  }

  async function openSaveAsTarget(
    workflow: ComfyWorkflow,
    newPath: string,
    operation: ReturnType<typeof watchSaveAsSource>,
    rememberCopy: (copy: ComfyWorkflow) => void
  ): Promise<ComfyWorkflow | null> {
    if (workflow.isTemporary) {
      await renameWorkflow(workflow, newPath)
      return operation.isCurrent() ? workflow : null
    }
    const target = workflowStore.saveAs(workflow, newPath)
    rememberCopy(target)
    const opened = await openWorkflow(target, {
      isCurrent: operation.isCurrent
    })
    return opened && operation.isCurrent() ? target : null
  }

  async function saveAsTarget(
    workflow: ComfyWorkflow,
    options: { filename?: string; isApp?: boolean },
    operation: ReturnType<typeof watchSaveAsSource>,
    rememberCopy: (copy: ComfyWorkflow) => void
  ): Promise<boolean> {
    if (!operation.isCurrent()) return false
    const newFilename = options.filename ?? (await workflow.promptSave())
    if (!newFilename || !operation.isCurrent()) return false
    const isApp = options.isApp ?? workflow.initialMode === 'app'
    const newPath =
      workflow.directory + '/' + appendWorkflowJsonExt(newFilename, isApp)
    const destination = await prepareSaveAsDestination(
      workflow,
      newPath,
      operation
    )
    if (destination === 'cancelled' || !operation.isCurrent()) return false
    return writeSaveAsTarget(workflow, options, operation, rememberCopy, {
      isApp,
      newPath,
      destination
    })
  }

  async function writeSaveAsTarget(
    workflow: ComfyWorkflow,
    options: { filename?: string; isApp?: boolean },
    operation: ReturnType<typeof watchSaveAsSource>,
    rememberCopy: (copy: ComfyWorkflow) => void,
    {
      isApp,
      newPath,
      destination
    }: { isApp: boolean; newPath: string; destination: 'self' | 'copy' }
  ): Promise<boolean> {
    const target =
      destination === 'self'
        ? workflow
        : await openSaveAsTarget(workflow, newPath, operation, rememberCopy)
    if (!target || !operation.isCurrent()) return false
    if (destination !== 'self' && options.isApp !== undefined) {
      useApp().rootGraph.extra.linearMode = isApp
      target.initialMode = isApp ? 'app' : 'graph'
    }
    target.changeTracker?.prepareForSave()
    if (!operation.isCurrent()) return false
    await workflowStore.saveWorkflow(target, { signal: operation.signal })
    if (!operation.isCurrent()) return false
    useTelemetry()?.trackWorkflowSaved({ is_app: isApp, is_new: true })
    return true
  }

  const saveWorkflowAs = async (
    workflow: ComfyWorkflow,
    options: { filename?: string; isApp?: boolean } = {}
  ): Promise<boolean> => {
    let copy: ComfyWorkflow | undefined
    const operation = watchSaveAsSource(workflow)
    try {
      return await saveAsTarget(workflow, options, operation, (target) => {
        copy = target
      })
    } catch (error) {
      if (error instanceof SavedFileIdentityError && !operation.isCurrent())
        return false
      throw error
    } finally {
      operation.stop()
      if (!operation.isCurrent()) {
        if (copy) workflowStore.discardTemporaryWorkflow(copy)
        reportError(new SavedFileIdentityError('scope'), {
          surface: 'graph',
          errorType: 'error_saving_workflow_source_identity'
        })
        toast.error(t('workflowService.privateLinkUnavailable'))
      }
    }
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
  const loadDefaultWorkflow = () =>
    queueWorkflowLoad(() => useApp().loadGraphData(getDefaultWorkflow()))

  /**
   * Load a blank workflow
   */
  const loadBlankWorkflow = () =>
    queueWorkflowLoad(() => useApp().loadGraphData(blankGraph))

  /**
   * Reload the current workflow
   * Waits for queued loads; skipped when a later open replaces the workflow.
   */
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

  /**
   * Open a workflow in the current workspace
   * @param workflow The workflow to open
   * @param options The options for opening the workflow
   * @returns false when the graph load reported failure (the error dialog was
   * shown and the workflow never painted) or when the open was skipped because
   * the workflow is mid-close; true otherwise
   */
  /**
   * A failed replacement load leaves the shared root graph cleaned or
   * partially configured while the previous workflow stays selected
   * (16075 review). Repaint the retained workflow from its just-saved
   * state so selection, canvas, and change tracking agree again. No
   * retry loop: a failure here leaves the first failure's dialog
   * standing.
   */
  const restoreRetainedWorkflow = async (
    failed: ComfyWorkflow,
    isCurrent?: () => boolean
  ) => {
    const retained = getActiveWorkflow()
    if (!retained || retained.path === failed.path || !retained.isLoaded) return

    await useApp().loadGraphData(
      toRaw(retained.activeState) as ComfyWorkflowJSON,
      true,
      true,
      retained,
      {
        checkForRerouteMigration: false,
        deferWarnings: true,
        skipAssetScans: true,
        ...(isCurrent ? { isCurrent } : {})
      }
    )
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

  async function recoverFailedWorkflowOpen(
    workflow: ComfyWorkflow,
    loadFromRemote: boolean,
    wasModified: boolean,
    isCurrent?: () => boolean
  ) {
    if (isCurrent?.() !== false) {
      await restoreRetainedWorkflow(workflow, isCurrent)
    }
    if (isCurrent?.() === false && loadFromRemote) {
      discardSupersededLoad(workflow, wasModified)
    }
  }

  type OpenWorkflowOptions = {
    force?: boolean
    initiator?: 'user'
    navigationIntentId?: number
    isCurrent?: () => boolean
    keepSavedBaseline?: boolean
  }

  function isWorkflowOpenCurrent(
    workflow: ComfyWorkflow,
    options: OpenWorkflowOptions
  ) {
    return (
      options.isCurrent?.() !== false &&
      isUserFileIdentityCurrent(workflow.savedFileIdentity)
    )
  }

  async function loadWorkflowCanvas(
    workflow: ComfyWorkflow,
    options: OpenWorkflowOptions,
    loadFromRemote: boolean,
    navigationIntentId: number
  ) {
    workflow.changeTracker?.prepareForSave()
    const load = () =>
      useApp().loadGraphData(
        toRaw(workflow.activeState) as ComfyWorkflowJSON,
        true,
        true,
        workflow,
        {
          checkForRerouteMigration: false,
          deferWarnings: true,
          skipAssetScans: !loadFromRemote && !options.force,
          workflowNavigationId: navigationIntentId,
          ...(options.isCurrent ? { isCurrent: options.isCurrent } : {})
        }
      )
    return options.keepSavedBaseline && workflow.isModified
      ? await keepingSavedBaseline(workflow, load)
      : await load()
  }

  const openWorkflow = (
    workflow: ComfyWorkflow,
    options: OpenWorkflowOptions = {}
  ): Promise<boolean> => {
    if (!isWorkflowOpenCurrent(workflow, options)) return Promise.resolve(false)
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
        if (!isWorkflowOpenCurrent(workflow, options)) {
          useSubgraphNavigationStore().endWorkflowNavigation(navigationIntentId)
          return false
        }
        const loadFromRemote = !workflow.isLoaded
        const wasModified = workflow.isModified
        if (loadFromRemote) {
          await workflow.load()
        }
        if (!isWorkflowOpenCurrent(workflow, options)) {
          if (loadFromRemote) discardSupersededLoad(workflow, wasModified)
          useSubgraphNavigationStore().endWorkflowNavigation(navigationIntentId)
          return false
        }

        const loaded = await loadWorkflowCanvas(
          workflow,
          options,
          loadFromRemote,
          navigationIntentId
        )
        if (loaded === false || options.isCurrent?.() === false) {
          useSubgraphNavigationStore().endWorkflowNavigation(navigationIntentId)
          await recoverFailedWorkflowOpen(
            workflow,
            loadFromRemote,
            wasModified,
            options.isCurrent
          )
          return false
        }
        showPendingWarnings(undefined, {
          silent: !loadFromRemote && !options.force
        })
        if (options.initiator === 'user')
          workflowStore.reportUserActivation(workflow)
        return true
      } catch (error) {
        useSubgraphNavigationStore().endWorkflowNavigation(navigationIntentId)
        throw error
      }
    }, workflow.path)
  }

  type CloseWorkflowOptions = {
    warnIfUnsaved: boolean
    hint?: string
    onReplacementOpened?: (workflow: ComfyWorkflow) => void
    isCurrent?: () => boolean
  }

  async function confirmClose(
    workflow: ComfyWorkflow,
    options: CloseWorkflowOptions
  ) {
    const confirmed = await dialogService.confirm({
      title: t('sideToolbar.workflowTab.dirtyCloseTitle'),
      type: 'dirtyClose',
      message: t('sideToolbar.workflowTab.dirtyClose'),
      itemList: [workflow.path],
      hint: options.hint,
      denyLabel: t('sideToolbar.workflowTab.dirtyCloseAnyway')
    })
    if (confirmed === null || options.isCurrent?.() === false) return false
    if (!confirmed) return true
    const saved = await saveWorkflow(workflow)
    return saved && options.isCurrent?.() !== false
  }

  async function waitForClosingWorkflowLoads(workflow: ComfyWorkflow) {
    const wasActive = workflowStore.isActive(workflow)
    const pendingWorkflowLoad = pendingWorkflowLoadsByPath.get(workflow.path)
    if (!wasActive && pendingWorkflowLoad) await pendingWorkflowLoad
    if (
      !wasActive &&
      !(pendingWorkflowLoad && workflowStore.isActive(workflow))
    )
      return
    for (let spins = 0; spins < 16; spins++) {
      const observedOpenTail = workflowLoadTail
      await observedOpenTail
      if (observedOpenTail === workflowLoadTail) break
    }
  }

  function findClosingReplacement() {
    const recent = workflowStore.getMostRecentWorkflow()
    if (recent && !closingWorkflowCounts.has(closingKey(recent))) return recent
    for (let shift = 1; shift < workflowStore.openWorkflows.length; shift++) {
      const candidate = workflowStore.openedWorkflowIndexShift(shift)
      if (candidate && !closingWorkflowCounts.has(closingKey(candidate)))
        return candidate
    }
  }

  async function loadClosingDefault(options: CloseWorkflowOptions) {
    if (options.isCurrent?.() === false) return false
    if (
      (await loadDefaultWorkflow()) === false ||
      options.isCurrent?.() === false
    )
      return false
    const opened = workflowStore.activeWorkflow
    if (opened) options.onReplacementOpened?.(opened)
    return true
  }

  async function openClosingReplacement(
    workflow: ComfyWorkflow,
    options: CloseWorkflowOptions
  ) {
    if (workflowStore.isActive(workflow)) {
      const replacement = findClosingReplacement()
      if (!replacement) return loadClosingDefault(options)
      if (
        !(await openWorkflow(replacement, { isCurrent: options.isCurrent })) ||
        options.isCurrent?.() === false
      )
        return false
      options.onReplacementOpened?.(replacement)
    } else if (
      workflowStore.openWorkflows.length > 0 &&
      workflowStore.openWorkflows.every((open) =>
        closingWorkflowCounts.has(closingKey(open))
      )
    ) {
      return loadClosingDefault(options)
    }
    return true
  }

  async function finishWorkflowClose(
    workflow: ComfyWorkflow,
    closingPath: string,
    options: CloseWorkflowOptions
  ) {
    if (options.isCurrent?.() === false) return false
    await workflowStore.closeWorkflow(workflow)
    if (options.isCurrent?.() === false) return false
    workflowDraftStore.removeDraft(closingPath)
    useNodeOutputStore().discardPreviewsForWorkflow(closingPath)
    return true
  }

  async function completeWorkflowClose(
    workflow: ComfyWorkflow,
    closingPath: string,
    options: CloseWorkflowOptions
  ) {
    if (options.isCurrent?.() === false) return false
    if (!(await openClosingReplacement(workflow, options))) return false
    return await finishWorkflowClose(workflow, closingPath, options)
  }

  const closeWorkflow = async (
    workflow: ComfyWorkflow,
    options: CloseWorkflowOptions = { warnIfUnsaved: true }
  ): Promise<boolean> => {
    if (options.isCurrent?.() === false) return false
    if (
      workflow.isModified &&
      options.warnIfUnsaved &&
      !(await confirmClose(workflow, options))
    )
      return false
    const closingPath = workflow.path
    const closing = closingKey(workflow)
    closingWorkflowCounts.set(
      closing,
      (closingWorkflowCounts.get(closing) ?? 0) + 1
    )
    try {
      if (
        workflowStore.isActive(workflow) ||
        pendingWorkflowLoadsByPath.has(workflow.path)
      )
        await waitForClosingWorkflowLoads(workflow)
      return await completeWorkflowClose(workflow, closingPath, options)
    } finally {
      const remainingCloses = closingWorkflowCounts.get(closing) ?? 0
      if (remainingCloses <= 1) closingWorkflowCounts.delete(closing)
      else closingWorkflowCounts.set(closing, remainingCloses - 1)
    }
  }

  const renameWorkflow = async (workflow: ComfyWorkflow, newPath: string) => {
    const oldPath = workflow.path
    const graphId = workflow.activeState?.id
    await workflowStore.renameWorkflow(workflow, newPath)
    if (graphId) {
      useExecutionErrorStore().moveRunErrors(graphId, oldPath, workflow.path)
    }
  }

  const deleteWorkflow = async (
    workflow: ComfyWorkflow,
    silent = false,
    options: { isCurrent?: () => boolean; signal?: AbortSignal } = {}
  ): Promise<boolean> => {
    const isCurrent = options.isCurrent ?? (() => true)
    if (!isCurrent()) return false
    const bypassConfirm = !settingStore.get('Comfy.Workflow.ConfirmDelete')
    let confirmed: boolean | null = bypassConfirm || silent

    if (!confirmed) {
      confirmed = await dialogService.confirm({
        title: t('sideToolbar.workflowTab.confirmDeleteTitle'),
        type: 'delete',
        message: t('sideToolbar.workflowTab.confirmDelete'),
        itemList: [workflow.path]
      })
      if (!confirmed || !isCurrent()) return false
    }

    if (workflowStore.isOpen(workflow)) {
      await closeWorkflows([workflow], {
        warnIfUnsaved: !confirmed,
        initiator: silent ? undefined : 'user',
        isCurrent: options.isCurrent
      })
      if (workflowStore.isOpen(workflow)) return false
    }
    return finishWorkflowDeletion(workflow, silent, options)
  }

  async function finishWorkflowDeletion(
    workflow: ComfyWorkflow,
    silent: boolean,
    options: { isCurrent?: () => boolean; signal?: AbortSignal }
  ) {
    if (options.isCurrent?.() === false) return false
    await (options.signal
      ? workflowStore.deleteWorkflow(workflow, { signal: options.signal })
      : workflowStore.deleteWorkflow(workflow))
    if (options.isCurrent?.() === false) return false
    if (!silent) {
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
    // Use workspaceStore here as it is patched in unit tests.
    const workflowStore = useWorkspaceStore().workflow
    const activeWorkflow = workflowStore.activeWorkflow
    if (activeWorkflow) {
      // Typed as `ComfyWorkflow`: the active workflow's tracker can be absent
      // despite `LoadedComfyWorkflow`'s declared type.
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
      void workflowThumbnail.storeThumbnail(
        activeWorkflow,
        workflowStore.activeSubgraph || useApp().canvasOrUndefined?.graph
      )
      domWidgetStore.clear()

      // Save subgraph viewport before the canvas gets overwritten
      useSubgraphNavigationStore().saveCurrentViewport(suppressWorkflowReset)
    }
  }

  const afterLoadNewGraph = async (
    value: string | ComfyWorkflow | null,
    workflowData: ComfyWorkflowJSON,
    options: WorkflowActivationOptions = {}
  ) => {
    const { isCurrent } = options
    if (isCurrent?.() === false) return
    const graphState = useApp().rootGraphOrUndefined?.state
    await activateLoadedWorkflow(value, workflowData, options)
    if (
      graphState !== useApp().rootGraphOrUndefined?.state ||
      isCurrent?.() === false
    )
      return
    useNodeOutputStore().restorePreviewsForWorkflow(
      useWorkspaceStore().workflow.activeWorkflow?.path
    )
  }

  function canRestoreWorkflow(
    workflow: ComfyWorkflow,
    workflowData: ComfyWorkflowJSON,
    isActive: boolean
  ) {
    if (workflow.isPersisted && !workflow.isLoaded) return true
    if (!isActive) return false
    return (
      workflow.isTemporary ||
      areWorkflowIdsEquivalent(
        workflow.activeState?.id,
        workflowData.id,
        workflow.legacyId
      )
    )
  }

  function restoreInitialMode(
    loadedWorkflow: LoadedComfyWorkflow,
    freshLoadMode: AppMode | null
  ) {
    if (loadedWorkflow.initialMode !== undefined) return false
    const initialState = (loadedWorkflow as ComfyWorkflow).initialState
    if (!initialState) {
      reportWorkflowStateAnomaly(
        'Activated workflow has no initial state',
        'activateLoadedWorkflow.initialMode',
        loadedWorkflow,
        { isActive: useWorkspaceStore().workflow.isActive(loadedWorkflow) }
      )
    }
    loadedWorkflow.initialMode =
      linearModeToAppMode(initialState?.extra?.linearMode) ?? freshLoadMode
    return true
  }

  function createActivationContext(
    workflowData: ComfyWorkflowJSON,
    options: WorkflowActivationOptions
  ) {
    const graphState = useApp().rootGraphOrUndefined?.state
    const { isAppMode } = useAppMode()
    const wasAppMode = isAppMode.value
    const rootGraphId = adoptRootGraphId(workflowData)
    const freshLoadMode = linearModeToAppMode(workflowData.extra?.linearMode)
    useAppModeStore().loadSelections(workflowData.extra?.linearData)
    return { graphState, wasAppMode, rootGraphId, freshLoadMode, options }
  }

  async function openActivationWorkflow(
    workflow: ComfyWorkflow,
    options: WorkflowActivationOptions
  ) {
    const workflowStore = useWorkspaceStore().workflow
    const loaded = await (options.isCurrent
      ? workflowStore.openWorkflow(workflow, { isCurrent: options.isCurrent })
      : workflowStore.openWorkflow(workflow))
    options.onActivated?.(loaded)
    return loaded
  }

  function trackAppEntry(workflow: ComfyWorkflow, wasAppMode: boolean) {
    if (!wasAppMode && workflow.initialMode === 'app')
      useTelemetry()?.trackEnterLinear({ source: 'workflow' })
  }

  async function restoreActivatedDocument(
    workflow: ComfyWorkflow,
    workflowData: ComfyWorkflowJSON,
    context: ReturnType<typeof createActivationContext>,
    mode: 'fresh' | 'loaded'
  ) {
    const loaded = await openActivationWorkflow(workflow, context.options)
    if (context.graphState !== useApp().rootGraphOrUndefined?.state) return
    useExecutionErrorStore().setActiveGraph(context.rootGraphId, loaded.path)
    if (mode === 'fresh') {
      if (context.options.shareId) loaded.shareId = context.options.shareId
      if (loaded.initialMode === undefined) {
        loaded.initialMode = context.freshLoadMode
        trackAppEntry(loaded, context.wasAppMode)
      }
    } else {
      if (restoreInitialMode(loaded, context.freshLoadMode))
        trackAppEntry(loaded, context.wasAppMode)
      if (context.options.shareId) loaded.shareId = context.options.shareId
    }
    loaded.legacyId ??= getLegacyWorkflowId(workflowData.id)
    resetAndRestoreTracker(
      loaded,
      workflowData,
      useWorkspaceStore().workflow.isActive(loaded)
    )
  }

  async function activateTemporaryDocument(
    value: string | null,
    workflowData: ComfyWorkflowJSON,
    context: ReturnType<typeof createActivationContext>
  ) {
    const temp = useWorkspaceStore().workflow.createNewTemporary(
      value ? appendJsonExt(value) : undefined,
      workflowData
    )
    temp.initialMode = context.freshLoadMode
    if (context.options.shareId) temp.shareId = context.options.shareId
    trackAppEntry(temp, context.wasAppMode)
    const loaded = await openActivationWorkflow(temp, context.options)
    if (context.graphState !== useApp().rootGraphOrUndefined?.state) return
    useExecutionErrorStore().setActiveGraph(context.rootGraphId, loaded.path)
  }

  const activateLoadedWorkflow = async (
    value: string | ComfyWorkflow | null,
    workflowData: ComfyWorkflowJSON,
    options: WorkflowActivationOptions = {}
  ) => {
    const context = createActivationContext(workflowData, options)
    if (value !== null && typeof value !== 'string')
      return restoreActivatedDocument(value, workflowData, context, 'fresh')
    const store = useWorkspaceStore().workflow
    const existing = value
      ? store.getWorkflowByPath(ComfyWorkflow.basePath + appendJsonExt(value))
      : null
    if (
      existing &&
      canRestoreWorkflow(existing, workflowData, store.isActive(existing))
    )
      return restoreActivatedDocument(existing, workflowData, context, 'loaded')
    return activateTemporaryDocument(value, workflowData, context)
  }

  /**
   * Insert the given workflow into the current graph editor.
   */
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
    // unknown conversion: ComfyWorkflowJSON is stricter than LiteGraph's
    // serialisation schema.
    const items = workflowToClipboardItems(
      workflowJSON as unknown as SerialisableGraph
    )
    canvas._deserializeItems(items, options)
  }

  const closeWorkflows = async (
    workflows: ComfyWorkflow[],
    {
      initiator,
      ...options
    }: {
      warnIfUnsaved: boolean
      hint?: string
      initiator?: 'user'
      isCurrent?: () => boolean
    }
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
  const duplicateWorkflow = async (workflow: ComfyWorkflow) => {
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
      useApp().loadGraphData(state, true, true, duplicate)
    )
  }

  /**
   * Shows the missing node, model and media warnings stored on a workflow (the
   * active one by default) and keeps them for later tab switches.
   */
  function showPendingWarnings(
    workflow?: ComfyWorkflow | null,
    options?: { silent?: boolean }
  ) {
    const wf = workflow ?? workflowStore.activeWorkflow
    if (!wf) return

    const { missingNodeTypes, missingModelCandidates, missingMediaCandidates } =
      wf.pendingWarnings ?? {}

    if (nodeTypesMayStillArrive()) {
      const rootGraph = useApp().rootGraphOrUndefined
      if (rootGraph) showPlaceholdersAsWaiting(rootGraph)
    } else if (
      missingNodesErrorStore.surfaceMissingNodes(missingNodeTypes ?? []) &&
      !options?.silent
    ) {
      showMissingNodesNotice(missingNodeTypes ?? [])
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
    saveWorkflowAs,
    saveWorkflow,
    loadDefaultWorkflow,
    loadBlankWorkflow,
    reloadCurrentWorkflow,
    openWorkflow,
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
    beforeLoadNewGraph
  }
}

provideWorkflowService(useWorkflowService)
