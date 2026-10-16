import { storeToRefs } from 'pinia'
import { computed, onScopeDispose, ref } from 'vue'
import { useI18n } from 'vue-i18n'

import { useToast } from '@/components/ui/toast/toastStore'
import type { AgentWorkflowBindSource } from '@/platform/telemetry/types'
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
import type {
  CloudListingStatus,
  useAgentWorkflowResolver
} from './useAgentWorkflowResolver'

type RestorationOutcome =
  | { outcome: 'open'; target: ComfyWorkflow }
  | { outcome: 'unresolved'; listed: boolean }
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
  const {
    selectedWorkflow: selectedTarget,
    canRestoreWorkflow,
    targetUnresolved,
    unresolvedTargetListed
  } = storeToRefs(panelStore)
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
    cloudListingStatus,
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
    toast.warning(t('shareWorkflow.saveFailedTitle'), { description: detail })
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

  async function resolveRestorationTarget(
    workflowId: string,
    isCurrent: () => boolean
  ): Promise<RestorationOutcome> {
    await refreshCloudWorkflowIds()
    if (!isCurrent()) return { outcome: 'superseded' }
    const listingStatus = cloudListingStatus(workflowId)
    if (needsLifecycleLookup(workflowId, listingStatus)) {
      const lifecycle = await cloudWorkflowLifecycle(workflowId)
      if (!isCurrent()) return { outcome: 'superseded' }
      if (lifecycle === 'gone') return { outcome: 'deleted' }
    }
    const known =
      boundOrOpenWorkflowFor(workflowId) ?? storedWorkflowFor(workflowId)
    if (known !== null) return { outcome: 'open', target: known }
    await workflowStore.syncWorkflows()
    if (!isCurrent()) return { outcome: 'superseded' }
    const synced = storedWorkflowFor(workflowId)
    if (synced !== null) return { outcome: 'open', target: synced }
    return { outcome: 'unresolved', listed: listingStatus === 'listed' }
  }

  function needsLifecycleLookup(
    workflowId: string,
    listingStatus: CloudListingStatus
  ): boolean {
    switch (listingStatus) {
      case 'listed':
        return false
      case 'omitted':
        return true
      case 'unknown':
        return (
          boundOrOpenWorkflowFor(workflowId) === null &&
          storedWorkflowFor(workflowId) === null
        )
    }
  }

  function onWorkflowRestored(
    workflowId: string | undefined,
    isSessionCurrent: () => boolean
  ): Promise<boolean> {
    return restoreWorkflowTarget(
      workflowId,
      isSessionCurrent,
      () => canRestoreWorkflow.value
    )
  }

  function retryUnresolvedTarget(
    workflowId: string | undefined,
    isSessionCurrent: () => boolean
  ): Promise<boolean> {
    return restoreWorkflowTarget(
      workflowId,
      isSessionCurrent,
      () => targetUnresolved.value && !unresolvedTargetListed.value
    )
  }

  async function restoreWorkflowTarget(
    workflowId: string | undefined,
    isSessionCurrent: () => boolean,
    canRestore: () => boolean
  ): Promise<boolean> {
    if (!isSessionCurrent()) return false
    if (!canRestore()) return true
    const generation = ++targetSelectionGeneration
    const isCurrent = () =>
      generation === targetSelectionGeneration &&
      isSessionCurrent() &&
      canRestore()
    if (workflowId === undefined) return true
    const cached = cachedOpenWorkflowFor(workflowId)
    if (cached !== null)
      return openRestoredWorkflow(cached, workflowId, isCurrent)
    const resolved = await resolveRestorationTarget(workflowId, isCurrent)
    switch (resolved.outcome) {
      case 'superseded':
        return false
      case 'deleted':
        panelStore.markWorkflowTargetUnavailable()
        return true
      case 'open':
        return openRestoredWorkflow(resolved.target, workflowId, isCurrent)
      case 'unresolved':
        panelStore.retainUnresolvedTarget(resolved.listed)
        return true
    }
  }

  async function openRestoredWorkflow(
    target: ComfyWorkflow,
    workflowId: string,
    isCurrent: () => boolean
  ): Promise<boolean> {
    try {
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
    retryTarget: retryUnresolvedTarget,
    requestReferences: onRequestWorkflowReferences,
    cancelSelection
  }
}
