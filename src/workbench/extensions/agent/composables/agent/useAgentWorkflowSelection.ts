import { storeToRefs } from 'pinia'
import { computed, onScopeDispose, ref } from 'vue'
import { useI18n } from 'vue-i18n'

import type { AgentWorkflowBindSource } from '@/platform/telemetry/types'
import { useToastStore } from '@/platform/updates/common/toastStore'
import { useWorkflowService } from '@/platform/workflow/core/services/workflowService'
import type { ComfyWorkflow } from '@/platform/workflow/management/stores/comfyWorkflow'
import { useWorkflowStore } from '@/platform/workflow/management/stores/workflowStore'

import { useAgentComposerStore } from '../../stores/agent/agentComposerStore'
import { useAgentPanelStore } from '../../stores/agent/agentPanelStore'
import { useAgentWorkflowTabBindingStore } from '../../stores/agent/agentWorkflowTabBindingStore'
import type {
  WorkflowReferenceMetadata,
  WorkflowReferenceOption
} from '../../types/workflowReference'
import type { useAgentWorkflowResolver } from './useAgentWorkflowResolver'

/**
 * What a restoration attempt resolved to: a tab to reopen (`target: null`
 * leaves `openRestoredWorkflow` to look one up after a catalog sync), a target
 * the server says is gone, or a restoration another selection has already
 * overtaken.
 */
type RestorationOutcome =
  | { outcome: 'open'; target: ComfyWorkflow | null }
  | { outcome: 'deleted' }
  | { outcome: 'superseded' }

interface WorkflowSelectionOptions {
  resolver: ReturnType<typeof useAgentWorkflowResolver>
  canSelectTarget: () => boolean
  warnWorkflowUnavailable: () => void
  warnRestoreFailed: () => void
  onTargetBound?: (
    workflowId: string,
    previousWorkflowId: string | null,
    source: Extract<AgentWorkflowBindSource, 'selector_chip' | 'restored'>
  ) => void
}

export function useAgentWorkflowSelection({
  resolver,
  canSelectTarget,
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
  const toast = useToastStore()
  const {
    refreshCloudWorkflowIds,
    cloudIdFor,
    cloudWorkflowName,
    nextSaveFilename,
    boundOrOpenWorkflowFor,
    cachedOpenWorkflowFor,
    storedWorkflowFor,
    isCloudWorkflowListed,
    isCloudListingComplete,
    cloudWorkflowLifecycle
  } = resolver
  const editableWorkflowId = computed(() =>
    selectedTarget.value ? cloudIdFor(selectedTarget.value) : undefined
  )
  let composerContextGeneration = 0

  const workflowSelection = ref<{
    purpose: 'target' | 'reference'
    workflow: ComfyWorkflow
  } | null>(null)
  const selectingTarget = computed(() =>
    workflowSelection.value?.purpose === 'target'
      ? workflowSelection.value.workflow
      : null
  )
  const savingReference = computed(
    () => workflowSelection.value?.purpose === 'reference'
  )
  let targetSelectionGeneration = 0
  function onVisibleWorkflowChanged(): void {
    if (!panelStore.followsVisibleWorkflow) return
    if (
      workflowSelection.value?.purpose === 'target' &&
      workflowSelection.value.workflow !== workflowStore.activeWorkflow
    )
      ++targetSelectionGeneration
  }

  function commitWorkflowTarget(
    workflow: ComfyWorkflow,
    workflowId: string,
    source: Extract<AgentWorkflowBindSource, 'selector_chip' | 'restored'>,
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
    try {
      if (tab.isTemporary && cloudIdFor(tab) === undefined) {
        if (!(await refreshCloudWorkflowIds())) return fail()
        if (!isCurrent()) return
        const filename = nextSaveFilename(tab)
        if (!(await workflowService.saveWorkflowAs(tab, { filename })))
          return fail()
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
    toast.add({
      severity: 'warn',
      summary: t('shareWorkflow.saveFailedTitle'),
      detail
    })
  }

  async function onSelectWorkflowTarget(path: string): Promise<boolean> {
    const tab = workflowStore.getWorkflowByPath(path)
    if (!tab || workflowSelection.value || !canSelectTarget()) return false
    workflowSelection.value = { purpose: 'target', workflow: tab }
    const generation = ++targetSelectionGeneration
    const isCurrent = () =>
      generation === targetSelectionGeneration &&
      workflowStore.openWorkflows.includes(tab)
    try {
      const workflowId = await prepareWorkflowSelection(tab, isCurrent)
      if (workflowId === undefined || !isCurrent()) return false
      const previousWorkflowId = editableWorkflowId.value ?? null
      if (!(await workflowService.openWorkflow(tab))) {
        if (isCurrent())
          warnWorkflowSelectionFailed(t('agent.targetNavigationUnavailable'))
        return false
      }
      if (!isCurrent()) return false
      commitWorkflowTarget(tab, workflowId, 'selector_chip', previousWorkflowId)
      return true
    } catch (error) {
      if (isCurrent())
        warnWorkflowSelectionFailed(
          error instanceof Error ? error.message : undefined
        )
      return false
    } finally {
      workflowSelection.value = null
    }
  }

  async function onSelectWorkflowReference(
    option: WorkflowReferenceOption
  ): Promise<WorkflowReferenceMetadata | undefined> {
    if (workflowSelection.value) return undefined
    if (option.id !== undefined) {
      if (
        option.id === editableWorkflowId.value ||
        workflowReferences.value.some(({ id }) => id === option.id)
      )
        return undefined
      return option
    }
    const tab = workflowStore.getWorkflowByPath(option.tabPath)
    if (!tab || !workflowStore.openWorkflows.includes(tab)) return undefined
    workflowSelection.value = { purpose: 'reference', workflow: tab }
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
      workflowSelection.value = null
    }
  }

  function onRequestWorkflowReferences(): void {
    if (!workflowSelection.value) void refreshCloudWorkflowIds()
  }

  /**
   * Whether a successful listing that came back without `workflowId` is
   * evidence about it at all. It is not when the walk gave up early: a partial
   * index explains nothing about the pages it never read.
   */
  function completeListingOmits(listed: boolean, workflowId: string): boolean {
    return (
      listed && isCloudListingComplete() && !isCloudWorkflowListed(workflowId)
    )
  }

  /**
   * Resolves the tab a restored chat should reopen, or decides that its target
   * is gone. A failed listing stays a retryable restoration failure rather than
   * a verdict.
   *
   * `GET /api/workflows` cannot answer this on its own. It excludes
   * version-less rows on purpose — those are the agent's own working copies,
   * hidden from the user's list until a save or run promotes them (cloud
   * `common/workflow/repository.go`, whose `List` filters on
   * `LatestVersionIDNotNil`) — and it is a snapshot a concurrent save can
   * outrun. So when something local still answers for the id, the omission is
   * taken to the one read that *is* authoritative: `GET /api/workflows/{id}`,
   * which excludes soft-deleted rows but not version-less ones, so a live draft
   * answers 200 and a deleted workflow 404.
   *
   * That is deliberately not a test of the local tab's own `isTemporary` flag.
   * A flag on local userdata cannot distinguish "never promoted" from
   * "promoted by a run, then deleted" — a run promotes the cloud row while the
   * tab stays temporary — and reading it after the listing resolves also loses
   * a save that landed while the listing was in flight. Both of those are
   * answered by asking about the id instead of inferring from the tab.
   *
   * With no local owner the omission still ends the chase: there is nothing to
   * focus, so the target is unavailable whether the row was deleted or merely
   * unlisted, and the saved-workflow stale-binding policy is unchanged.
   * `matchesWorkflow` admits a temporary tab only as the id's verified owner,
   * so none of this can hand a chat someone else's unsaved tab that merely
   * occupies the same default path.
   */
  async function resolveRestorationTarget(
    workflowId: string,
    isCurrent: () => boolean
  ): Promise<RestorationOutcome> {
    const listed = await refreshCloudWorkflowIds()
    if (!isCurrent()) return { outcome: 'superseded' }
    const target =
      boundOrOpenWorkflowFor(workflowId) ?? storedWorkflowFor(workflowId)
    if (!completeListingOmits(listed, workflowId))
      return { outcome: 'open', target }
    if (target === null) return { outcome: 'deleted' }
    const lifecycle = await cloudWorkflowLifecycle(workflowId)
    if (!isCurrent()) return { outcome: 'superseded' }
    return lifecycle === 'gone'
      ? { outcome: 'deleted' }
      : { outcome: 'open', target }
  }

  async function onWorkflowRestored(
    workflowId: string | undefined,
    isSessionCurrent: () => boolean
  ): Promise<boolean> {
    if (!isSessionCurrent()) return false
    // A target that is already decided (e.g. a remounted panel) needs no
    // restoration, so the chat is ready as far as its workflow goes.
    if (!canRestoreWorkflow.value) return true
    const generation = ++targetSelectionGeneration
    const isCurrent = () =>
      generation === targetSelectionGeneration &&
      isSessionCurrent() &&
      canRestoreWorkflow.value
    if (workflowId === undefined) return true
    const cached = cachedOpenWorkflowFor(workflowId)
    if (cached !== null)
      return openRestoredWorkflow(cached, workflowId, isCurrent)
    const resolved = await resolveRestorationTarget(workflowId, isCurrent)
    if (resolved.outcome === 'superseded') return false
    if (resolved.outcome === 'deleted') {
      panelStore.markWorkflowTargetUnavailable()
      return true
    }
    return openRestoredWorkflow(resolved.target, workflowId, isCurrent)
  }

  async function openRestoredWorkflow(
    target: ComfyWorkflow | null,
    workflowId: string,
    isCurrent: () => boolean
  ): Promise<boolean> {
    try {
      if (target === null) {
        await workflowStore.syncWorkflows()
        if (!isCurrent()) return false
        target = storedWorkflowFor(workflowId)
      }
      if (target === null) {
        panelStore.setWorkflowTarget(null)
        warnRestoreFailed()
        return false
      }
      const opened = await workflowService.openWorkflow(target, { isCurrent })
      if (!isCurrent()) return false
      if (!opened) {
        panelStore.setWorkflowTarget(null)
        warnRestoreFailed()
        return false
      }
      commitWorkflowTarget(target, workflowId, 'restored')
      return true
    } catch {
      if (!isCurrent()) return false
      warnRestoreFailed()
      return false
    }
  }

  function cancelSelection(): void {
    ++composerContextGeneration
    ++targetSelectionGeneration
  }
  onScopeDispose(cancelSelection)

  return {
    isSelecting: computed(() => workflowSelection.value !== null),
    selectingTarget,
    savingReference,
    onVisibleWorkflowChanged,
    selectTarget: onSelectWorkflowTarget,
    selectReference: onSelectWorkflowReference,
    restoreTarget: onWorkflowRestored,
    requestReferences: onRequestWorkflowReferences,
    cancelSelection
  }
}
