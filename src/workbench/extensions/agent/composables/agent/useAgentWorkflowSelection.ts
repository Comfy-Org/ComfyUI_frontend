import { until } from '@vueuse/core'
import { storeToRefs } from 'pinia'
import { computed, nextTick, onScopeDispose, ref } from 'vue'
import { useI18n } from 'vue-i18n'

import { useToast } from '@/components/ui/toast/toastStore'
import { validateComfyWorkflow } from '@comfyorg/graph-model/workflowSchema'
import { reportError } from '@comfyorg/telemetry/reportError'
import type {
  AgentTargetUnavailableCause,
  AgentWorkflowBindSource
} from '@comfyorg/telemetry/types'
import { useWorkflowService } from '@/platform/workflow/core/services/workflowService'
import type { OpenWorkflowFailure } from '@/platform/workflow/core/services/workflowService'
import type { ComfyWorkflow } from '@/platform/workflow/management/stores/comfyWorkflow'
import { useWorkflowStore } from '@/platform/workflow/management/stores/workflowStore'

import type { CloudWorkflowRecord } from '@/workbench/extensions/agent/services/agent/agentRestClient'
import { useAgentComposerStore } from '@/workbench/extensions/agent/stores/agent/agentComposerStore'
import { useAgentPanelStore } from '@/workbench/extensions/agent/stores/agent/agentPanelStore'
import { useAgentWorkflowTabBindingStore } from '@/workbench/extensions/agent/stores/agent/agentWorkflowTabBindingStore'
import type {
  WorkflowReferenceMetadata,
  WorkflowReferenceOption
} from '@/workbench/extensions/agent/types/workflowReference'
import type {
  CloudWorkflowLifecycle,
  useAgentWorkflowResolver
} from './useAgentWorkflowResolver'

type RebuildCause = Extract<
  AgentTargetUnavailableCause,
  'restore_not_listed' | 'restore_out_of_sync'
>

type RestorationOutcome =
  | { outcome: 'open'; target: ComfyWorkflow | null }
  | {
      outcome: 'rebuild'
      row: CloudWorkflowRecord
      cause: RebuildCause
      startupTabRestoreSettled: boolean
    }
  | {
      outcome: 'deleted'
      cause: Exclude<AgentTargetUnavailableCause, 'workflow_deleted'>
      startupTabRestoreSettled: boolean
    }
  | { outcome: 'superseded' }

type RestorationSource = 'cached' | 'resolved' | 'rebuilt'

interface WorkflowRestoration {
  ready: boolean
  committedWorkflowId: string | null
}

type ExactPathRestoration =
  | { outcome: 'continue'; target: ComfyWorkflow | null }
  | { outcome: 'complete'; restoration: WorkflowRestoration }

const STARTUP_TAB_RESTORE_TIMEOUT_MS = 15_000

const NOT_RESTORED: WorkflowRestoration = {
  ready: true,
  committedWorkflowId: null
}
const RESTORE_ABANDONED: WorkflowRestoration = {
  ready: false,
  committedWorkflowId: null
}

function restorationOutcomeFor(
  lifecycle: CloudWorkflowLifecycle,
  target: ComfyWorkflow | null,
  startupTabRestoreSettled: boolean
): RestorationOutcome {
  switch (lifecycle) {
    case 'gone':
      return {
        outcome: 'deleted',
        cause: 'restore_gone',
        startupTabRestoreSettled
      }
    case 'live':
    case 'unknown':
      return { outcome: 'open', target }
  }
}

interface WorkflowSelectionOptions {
  resolver: ReturnType<typeof useAgentWorkflowResolver>
  warnWorkflowUnavailable: () => void
  warnRestoreFailed: () => void
  onTargetBound?: (
    workflowId: string,
    previousWorkflowId: string | null,
    source: Extract<AgentWorkflowBindSource, 'restored'>
  ) => void
}

export function useAgentWorkflowSelection({
  resolver,
  warnWorkflowUnavailable,
  warnRestoreFailed,
  onTargetBound
}: WorkflowSelectionOptions) {
  const workflowStore = useWorkflowStore()
  const workflowService = useWorkflowService()
  const bindingStore = useAgentWorkflowTabBindingStore()
  const panelStore = useAgentPanelStore()
  const { selectedWorkflow: selectedTarget, canRestoreWorkflow } =
    storeToRefs(panelStore)
  const composerStore = useAgentComposerStore()
  const { workflowReferences } = storeToRefs(composerStore)
  const { t } = useI18n()
  const toast = useToast()
  const {
    refreshCloudWorkflowIds,
    cloudIdFor,
    cloudWorkflowName,
    nextSaveFilename,
    boundOrOpenWorkflowFor,
    cachedOpenWorkflowFor,
    storedWorkflowFor,
    savedWorkflowAtPath,
    storedWorkflowByCloudPath,
    cloudListingOmits,
    cloudWorkflowLifecycle,
    cloudWorkflowRow,
    serverWorkflowContent
  } = resolver
  const editableWorkflowId = computed(() =>
    selectedTarget.value ? cloudIdFor(selectedTarget.value) : undefined
  )
  let composerContextGeneration = 0

  const savingReferenceDraftKey = ref<string | null>(null)
  let restorationGeneration = 0

  function commitWorkflowTarget(
    workflow: ComfyWorkflow,
    workflowId: string,
    source: Extract<AgentWorkflowBindSource, 'restored'>,
    previousWorkflowId: string | null = editableWorkflowId.value ?? null
  ): void {
    bindingStore.bind(workflowId, workflow.path)
    panelStore.setWorkflowTarget(workflow)
    composerStore.removeWorkflowReference(workflowId)
    if (workflowId !== previousWorkflowId)
      onTargetBound?.(workflowId, previousWorkflowId, source)
  }

  async function prepareWorkflowSelection(
    tab: ComfyWorkflow,
    isCurrent: () => boolean
  ): Promise<string | undefined> {
    function fail(detail?: string): undefined {
      if (isCurrent()) warnWorkflowSelectionFailed(detail)
      return undefined
    }
    const needsSave = () => tab.isTemporary && cloudIdFor(tab) === undefined
    try {
      if (needsSave()) {
        if (!(await refreshCloudWorkflowIds())) return fail()
        if (!isCurrent()) return
        if (!tab.isLoaded) {
          await workflowService.loadWorkflowInBackground(tab)
          if (!isCurrent()) return
        }
        if (needsSave()) {
          const filename = nextSaveFilename(tab)
          if (!(await workflowService.saveWorkflowAs(tab, { filename })))
            return fail()
        }
      }
      if (!isCurrent()) return
      let workflowId = cloudIdFor(tab)
      if (workflowId === undefined) {
        if (!(await refreshCloudWorkflowIds())) return fail()
        if (!isCurrent()) return
        workflowId = cloudIdFor(tab)
      }
      if (workflowId === undefined) warnWorkflowUnavailable()
      return workflowId
    } catch (error) {
      return fail(error instanceof Error ? error.message : undefined)
    }
  }

  function warnWorkflowSelectionFailed(
    detail = t('shareWorkflow.saveFailedDescription')
  ): void {
    toast.warning(t('shareWorkflow.saveFailedTitle'), { description: detail })
  }

  function savingReferenceFor(draftKey: string): boolean {
    return savingReferenceDraftKey.value === draftKey
  }

  function rekeySavingReference(from: string, to: string): void {
    if (savingReferenceDraftKey.value === from)
      savingReferenceDraftKey.value = to
  }

  async function onSelectWorkflowReference(
    option: WorkflowReferenceOption,
    draftKey: string
  ): Promise<WorkflowReferenceMetadata | undefined> {
    if (option.id !== undefined) {
      if (
        option.id === editableWorkflowId.value ||
        workflowReferences.value.some(({ id }) => id === option.id)
      )
        return undefined
      return option
    }
    if (savingReferenceDraftKey.value !== null) return undefined
    const tab = workflowStore.getWorkflowByPath(option.tabPath)
    if (!tab || !workflowStore.openWorkflows.includes(tab)) return undefined
    savingReferenceDraftKey.value = draftKey
    const generation = composerContextGeneration
    const isCurrent = () =>
      generation === composerContextGeneration &&
      workflowStore.openWorkflows.includes(tab)
    try {
      const workflowId = await prepareWorkflowSelection(tab, isCurrent)
      if (workflowId === undefined || !isCurrent()) return undefined
      if (
        workflowId === editableWorkflowId.value ||
        workflowReferences.value.some(({ id }) => id === workflowId)
      )
        return undefined
      bindingStore.bind(workflowId, tab.path)
      return {
        id: workflowId,
        name: cloudWorkflowName(tab)
      }
    } catch (error) {
      if (isCurrent())
        warnWorkflowSelectionFailed(
          error instanceof Error ? error.message : undefined
        )
      return undefined
    } finally {
      savingReferenceDraftKey.value = null
    }
  }

  function onRequestWorkflowReferences(): void {
    if (savingReferenceDraftKey.value === null) void refreshCloudWorkflowIds()
  }

  async function resolveRestorationTarget(
    workflowId: string,
    isCurrent: () => boolean
  ): Promise<RestorationOutcome> {
    const listed = await refreshCloudWorkflowIds()
    if (!isCurrent()) return { outcome: 'superseded' }
    let target = localOwnerFor(workflowId)
    if (target === null) {
      if (!(await startupTabsRestored(isCurrent)))
        return { outcome: 'superseded' }
      target = localOwnerFor(workflowId)
    }
    const startupTabRestoreSettled = workflowStore.tabsRestored
    if (!listed || !cloudListingOmits(workflowId))
      return { outcome: 'open', target }
    if (target === null)
      return resolveUnownedTarget(
        workflowId,
        isCurrent,
        startupTabRestoreSettled
      )
    const lifecycle = await cloudWorkflowLifecycle(workflowId)
    if (!isCurrent()) return { outcome: 'superseded' }
    return restorationOutcomeFor(
      lifecycle,
      localOwnerFor(workflowId),
      startupTabRestoreSettled
    )
  }

  async function resolveUnownedTarget(
    workflowId: string,
    isCurrent: () => boolean,
    startupTabRestoreSettled: boolean
  ): Promise<RestorationOutcome> {
    const row = await cloudWorkflowRow(workflowId)
    if (!isCurrent()) return { outcome: 'superseded' }
    const owner = localOwnerFor(workflowId)
    const lifecycle = typeof row === 'string' ? row : 'live'
    if (owner !== null || lifecycle === 'gone')
      return restorationOutcomeFor(lifecycle, owner, startupTabRestoreSettled)
    if (typeof row === 'string')
      return {
        outcome: 'deleted',
        cause: 'restore_not_listed',
        startupTabRestoreSettled
      }
    return {
      outcome: 'rebuild',
      row,
      cause: 'restore_not_listed',
      startupTabRestoreSettled
    }
  }

  function localOwnerFor(workflowId: string): ComfyWorkflow | null {
    return boundOrOpenWorkflowFor(workflowId) ?? storedWorkflowFor(workflowId)
  }

  async function startupTabsRestored(
    isCurrent: () => boolean
  ): Promise<boolean> {
    if (!workflowStore.tabsRestored) {
      await until(() => workflowStore.tabsRestored).toBe(true, {
        timeout: STARTUP_TAB_RESTORE_TIMEOUT_MS,
        throwOnTimeout: false
      })
      await nextTick()
    }
    return isCurrent()
  }

  async function onWorkflowRestored(
    workflowId: string | undefined,
    isSessionCurrent: () => boolean
  ): Promise<WorkflowRestoration> {
    if (!isSessionCurrent()) return RESTORE_ABANDONED
    if (!canRestoreWorkflow.value) return NOT_RESTORED
    const generation = ++restorationGeneration
    const isCurrent = () =>
      generation === restorationGeneration &&
      isSessionCurrent() &&
      canRestoreWorkflow.value
    if (workflowId === undefined) return NOT_RESTORED
    const cached = cachedOpenWorkflowFor(workflowId)
    if (cached !== null)
      return openRestoredWorkflow(cached, workflowId, isCurrent, 'cached')
    const resolved = await resolveRestorationTarget(workflowId, isCurrent)
    if (resolved.outcome === 'superseded' || !isCurrent())
      return RESTORE_ABANDONED
    if (resolved.outcome === 'deleted') {
      panelStore.markWorkflowTargetUnavailable({
        cause: resolved.cause,
        workflow_id: workflowId,
        startup_tab_restore_settled: resolved.startupTabRestoreSettled
      })
      return NOT_RESTORED
    }
    if (resolved.outcome === 'rebuild')
      return rebuildFromServer(
        resolved.row,
        isCurrent,
        resolved.cause,
        resolved.startupTabRestoreSettled
      )
    return openRestoredWorkflow(
      resolved.target,
      workflowId,
      isCurrent,
      'resolved'
    )
  }

  async function openRestoredWorkflow(
    target: ComfyWorkflow | null,
    workflowId: string,
    isCurrent: () => boolean,
    source: RestorationSource
  ): Promise<WorkflowRestoration> {
    try {
      if (!target?.isTemporary) {
        const exact = await exactPathRestoration(workflowId, isCurrent, source)
        if (exact.outcome === 'complete') return exact.restoration
        target = exact.target
      }
      if (target === null) {
        panelStore.setWorkflowTarget(null)
        failRestore(
          workflowId,
          new Error('No saved workflow resolves to the chat target'),
          { source }
        )
        return RESTORE_ABANDONED
      }
      const failure: { reason?: OpenWorkflowFailure } = {}
      const opened = await workflowService.openWorkflow(target, {
        isCurrent,
        failure
      })
      if (!isCurrent()) return RESTORE_ABANDONED
      if (!opened) {
        panelStore.setWorkflowTarget(null)
        if (failure.reason === 'unreadable') return NOT_RESTORED
        failRestore(
          workflowId,
          new Error('The chat target workflow did not open'),
          { source, openFailure: failure.reason ?? 'unknown' }
        )
        return RESTORE_ABANDONED
      }
      commitWorkflowTarget(target, workflowId, 'restored')
      return { ready: true, committedWorkflowId: workflowId }
    } catch (error) {
      if (!isCurrent()) return RESTORE_ABANDONED
      failRestore(workflowId, error, { source })
      return RESTORE_ABANDONED
    }
  }

  async function exactPathRestoration(
    workflowId: string,
    isCurrent: () => boolean,
    source: RestorationSource
  ): Promise<ExactPathRestoration> {
    const exact = await storedWorkflowByCloudPath(workflowId)
    if (!isCurrent())
      return { outcome: 'complete', restoration: RESTORE_ABANDONED }
    if (exact.outcome === 'gone') {
      panelStore.markWorkflowTargetUnavailable({
        cause: 'restore_gone',
        workflow_id: workflowId,
        startup_tab_restore_settled: workflowStore.tabsRestored
      })
      return { outcome: 'complete', restoration: NOT_RESTORED }
    }
    if (exact.outcome === 'out_of_sync')
      return {
        outcome: 'complete',
        restoration: await restoreOutOfSync(workflowId, isCurrent)
      }
    if (exact.outcome === 'failed') {
      panelStore.setWorkflowTarget(null)
      failRestore(workflowId, exact.cause, { source })
      return { outcome: 'complete', restoration: RESTORE_ABANDONED }
    }
    if (exact.workflow !== null)
      return { outcome: 'continue', target: exact.workflow }
    await workflowStore.syncWorkflows()
    if (!isCurrent())
      return { outcome: 'complete', restoration: RESTORE_ABANDONED }
    return {
      outcome: 'continue',
      target: savedWorkflowAtPath(exact.path)
    }
  }

  async function restoreOutOfSync(
    workflowId: string,
    isCurrent: () => boolean
  ): Promise<WorkflowRestoration> {
    const startupTabRestoreSettled = workflowStore.tabsRestored
    const row = await cloudWorkflowRow(workflowId)
    if (!isCurrent()) return RESTORE_ABANDONED
    if (typeof row !== 'string')
      return rebuildFromServer(
        row,
        isCurrent,
        'restore_out_of_sync',
        startupTabRestoreSettled
      )
    panelStore.markWorkflowTargetUnavailable({
      cause: row === 'gone' ? 'restore_gone' : 'restore_out_of_sync',
      workflow_id: workflowId,
      startup_tab_restore_settled: startupTabRestoreSettled
    })
    return NOT_RESTORED
  }

  async function rebuildFromServer(
    row: CloudWorkflowRecord,
    isCurrent: () => boolean,
    cause: RebuildCause,
    startupTabRestoreSettled: boolean
  ): Promise<WorkflowRestoration> {
    const server = await serverWorkflowContent(row)
    if (!isCurrent()) return RESTORE_ABANDONED
    const owner = localOwnerFor(row.id)
    if (owner?.isTemporary)
      return openRestoredWorkflow(owner, row.id, isCurrent, 'resolved')
    if (server.outcome === 'failed') {
      panelStore.setWorkflowTarget(null)
      warnRestoreFailed()
      return RESTORE_ABANDONED
    }
    const graph =
      server.outcome === 'none'
        ? null
        : await validateComfyWorkflow(server.content, (validationError) => {
            reportError(
              new Error('The server copy of the chat workflow is invalid'),
              {
                surface: 'agent',
                errorType: 'agent_workflow_rebuild_invalid',
                context: { workflowId: row.id, validationError }
              }
            )
          })
    if (!isCurrent()) return RESTORE_ABANDONED
    if (graph === null) {
      panelStore.markWorkflowTargetUnavailable({
        cause,
        workflow_id: row.id,
        startup_tab_restore_settled: startupTabRestoreSettled
      })
      return NOT_RESTORED
    }
    const known = new Set(workflowStore.workflows)
    const draft = workflowStore.createTemporary(
      row.name === undefined ? undefined : `${row.name}.json`,
      graph
    )
    const restoration = await openRestoredWorkflow(
      draft,
      row.id,
      isCurrent,
      'rebuilt'
    )
    if (restoration.committedWorkflowId === null && !known.has(draft))
      await workflowStore.closeWorkflow(draft)
    return restoration
  }

  function failRestore(
    workflowId: string,
    cause: unknown,
    tags: {
      source: RestorationSource
      openFailure?: OpenWorkflowFailure | 'unknown'
    }
  ): void {
    reportError(cause, {
      surface: 'agent',
      errorType: 'agent_workflow_restore_failed',
      tags,
      context: { workflowId }
    })
    warnRestoreFailed()
  }

  function adoptTarget(workflow: ComfyWorkflow, workflowId: string): void {
    commitWorkflowTarget(workflow, workflowId, 'restored')
  }

  function cancelSelection(): void {
    ++composerContextGeneration
    ++restorationGeneration
  }
  onScopeDispose(cancelSelection)

  return {
    savingReferenceFor,
    rekeySavingReference,
    selectReference: onSelectWorkflowReference,
    restoreTarget: onWorkflowRestored,
    adoptTarget,
    requestReferences: onRequestWorkflowReferences,
    cancelSelection
  }
}
