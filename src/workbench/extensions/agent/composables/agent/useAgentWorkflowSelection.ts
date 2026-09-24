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
    boundOrOpenWorkflowFor
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

  async function onWorkflowRestored(
    workflowId: string | undefined,
    isSessionCurrent: () => boolean
  ): Promise<void> {
    if (!canRestoreWorkflow.value || !isSessionCurrent()) return
    const generation = ++targetSelectionGeneration
    const isCurrent = () =>
      generation === targetSelectionGeneration &&
      isSessionCurrent() &&
      canRestoreWorkflow.value
    if (workflowId === undefined) return
    await refreshCloudWorkflowIds()
    if (!isCurrent()) return
    const target = boundOrOpenWorkflowFor(workflowId)
    if (target === null) {
      panelStore.setWorkflowTarget(null)
      warnWorkflowUnavailable()
      return
    }
    try {
      const opened = await workflowService.openWorkflow(target)
      if (!isCurrent()) return
      if (!opened) {
        panelStore.setWorkflowTarget(null)
        warnWorkflowUnavailable()
        return
      }
      commitWorkflowTarget(target, workflowId)
    } catch {
      if (!isCurrent()) return
      warnWorkflowUnavailable()
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
    selectTarget: onSelectWorkflowTarget,
    selectReference: onSelectWorkflowReference,
    restoreTarget: onWorkflowRestored,
    requestReferences: onRequestWorkflowReferences,
    cancelSelection
  }
}
