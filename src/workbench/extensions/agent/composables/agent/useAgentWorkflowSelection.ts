import { storeToRefs } from 'pinia'
import { computed, onScopeDispose, ref } from 'vue'
import { useI18n } from 'vue-i18n'

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

interface WorkflowSelectionOptions {
  resolver: ReturnType<typeof useAgentWorkflowResolver>
  canSelectTarget: () => boolean
  warnWorkflowUnavailable: () => void
}

export function useAgentWorkflowSelection({
  resolver,
  canSelectTarget,
  warnWorkflowUnavailable
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
    storedWorkflowFor,
    recoverWorkflowFor,
    forgetRecoveredWorkflow
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
  function commitWorkflowTarget(
    workflow: ComfyWorkflow,
    workflowId: string
  ): void {
    bindingStore.bind(workflowId, workflow.path)
    panelStore.setWorkflowTarget(workflow)
    composerStore.removeWorkflowReference(workflowId)
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
      if (!(await workflowService.openWorkflow(tab))) {
        if (isCurrent())
          warnWorkflowSelectionFailed(t('agent.targetNavigationUnavailable'))
        return false
      }
      if (!isCurrent()) return false
      commitWorkflowTarget(tab, workflowId)
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

  type RestoreOutcome =
    | { kind: 'superseded' }
    | { kind: 'unavailable' }
    | {
        kind: 'resolved'
        target: ComfyWorkflow
        /** Set only when this attempt created the tab, so only it may close it. */
        minted: ComfyWorkflow | null
        recovered: boolean
      }

  function isRestoreCurrent(
    generation: number,
    isSessionCurrent: () => boolean
  ): boolean {
    return (
      generation === targetSelectionGeneration &&
      isSessionCurrent() &&
      canRestoreWorkflow.value
    )
  }

  async function abandonMinted(minted: ComfyWorkflow | null): Promise<void> {
    if (minted !== null)
      await workflowService.closeWorkflow(minted, { warnIfUnsaved: false })
  }

  type SavedLookup =
    | { kind: 'superseded' }
    | { kind: 'found'; target: ComfyWorkflow }
    | { kind: 'missing'; authoritative: boolean }

  /**
   * `authoritative` is false when the Cloud index or the workflow list came
   * back stale. Both swallow their own failures, so without carrying that out
   * "nothing resolved" cannot be told apart from "we could not look".
   */
  async function findSavedTarget(
    workflowId: string,
    isCurrent: () => boolean
  ): Promise<SavedLookup> {
    const indexRefreshed = await refreshCloudWorkflowIds()
    if (!isCurrent()) return { kind: 'superseded' }
    const bound = boundOrOpenWorkflowFor(workflowId)
    if (bound !== null) return { kind: 'found', target: bound }
    // A workflow saved in an earlier session outranks the archive, which
    // would otherwise reconnect the thread to a fork of the pre-save graph.
    const synced = await workflowStore.syncWorkflows()
    if (!isCurrent()) return { kind: 'superseded' }
    const stored = storedWorkflowFor(workflowId)
    return stored !== null
      ? { kind: 'found', target: stored }
      : { kind: 'missing', authoritative: indexRefreshed && synced }
  }

  async function resolveRestoredTarget(
    workflowId: string,
    isCurrent: () => boolean
  ): Promise<RestoreOutcome> {
    const saved = await findSavedTarget(workflowId, isCurrent)
    if (saved.kind === 'superseded') return { kind: 'superseded' }
    if (saved.kind === 'found')
      return {
        kind: 'resolved',
        target: saved.target,
        minted: null,
        recovered: false
      }
    // Recovery only ever holds graphs that were never saved, so "nothing
    // resolved" has to be authoritative before it can mean "never saved".
    if (!saved.authoritative) return { kind: 'unavailable' }
    const recovery = await recoverWorkflowFor(workflowId)
    if (recovery === null) return { kind: 'unavailable' }
    const minted = recovery.minted ? recovery.workflow : null
    if (!isCurrent()) {
      await abandonMinted(minted)
      return { kind: 'superseded' }
    }
    return {
      kind: 'resolved',
      target: recovery.workflow,
      minted,
      recovered: true
    }
  }

  async function applyRestoredTarget(
    workflowId: string,
    {
      target,
      minted,
      recovered
    }: Extract<RestoreOutcome, { kind: 'resolved' }>,
    isCurrent: () => boolean
  ): Promise<void> {
    try {
      if (!(await workflowService.openWorkflow(target))) {
        await abandonMinted(minted)
        if (isCurrent()) {
          panelStore.setWorkflowTarget(null)
          warnWorkflowUnavailable()
        }
        return
      }
      // The thread keeps its tab even when the user has moved on, so coming
      // back to it finds the graph rather than starting the hunt again.
      bindingStore.bind(workflowId, target.path)
      if (recovered) forgetRecoveredWorkflow(workflowId)
      if (isCurrent()) commitWorkflowTarget(target, workflowId)
    } catch {
      await abandonMinted(minted)
      if (isCurrent()) warnWorkflowUnavailable()
    }
  }

  async function onWorkflowRestored(
    workflowId: string | undefined,
    isSessionCurrent: () => boolean
  ): Promise<void> {
    if (!canRestoreWorkflow.value || !isSessionCurrent()) return
    // Bumped before the id check so switching to a thread with no workflow
    // still cancels whatever restore was in flight.
    const generation = ++targetSelectionGeneration
    if (workflowId === undefined) return
    const isCurrent = () => isRestoreCurrent(generation, isSessionCurrent)
    const outcome = await resolveRestoredTarget(workflowId, isCurrent)
    if (outcome.kind === 'superseded') return
    if (outcome.kind === 'unavailable') {
      panelStore.setWorkflowTarget(null)
      warnWorkflowUnavailable()
      return
    }
    await applyRestoredTarget(workflowId, outcome, isCurrent)
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
    selectTarget: onSelectWorkflowTarget,
    selectReference: onSelectWorkflowReference,
    restoreTarget: onWorkflowRestored,
    requestReferences: onRequestWorkflowReferences,
    cancelSelection
  }
}
