import { storeToRefs } from 'pinia'
import { computed, onScopeDispose, ref } from 'vue'
import { useI18n } from 'vue-i18n'

import { useToast } from '@/components/ui/toast/toastStore'
import type { AgentWorkflowBindSource } from '@/platform/telemetry/types'
import { useWorkflowService } from '@/platform/workflow/core/services/workflowService'
import type { ComfyWorkflow } from '@/platform/workflow/management/stores/comfyWorkflow'
import type { ComfyWorkflowJSON } from '@/platform/workflow/validation/schemas/workflowSchema'
import { useWorkflowStore } from '@/platform/workflow/management/stores/workflowStore'

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

type RestorationOutcome =
  | { outcome: 'open'; target: ComfyWorkflow | null; listed: boolean }
  | { outcome: 'deleted' }
  | { outcome: 'superseded' }

function restorationOutcomeFor(
  lifecycle: CloudWorkflowLifecycle,
  target: ComfyWorkflow | null
): RestorationOutcome {
  switch (lifecycle) {
    case 'gone':
      return { outcome: 'deleted' }
    case 'live':
    case 'unknown':
      return { outcome: 'open', target, listed: false }
  }
}

interface WorkflowSelectionOptions {
  resolver: ReturnType<typeof useAgentWorkflowResolver>
  canSelectTarget: () => boolean
  warnWorkflowUnavailable: () => void
  warnRestoreFailed: () => void
  /**
   * The graph a local host keeps for a workflow, or null when it has none.
   * Lets a browser with no copy of a chat's workflow reopen it.
   */
  loadHostWorkflow?: (workflowId: string) => Promise<ComfyWorkflowJSON | null>
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
  loadHostWorkflow,
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
    cloudListingIncludes,
    cloudListingOmits,
    listedNameFor,
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

  /**
   * A complete listing that omits the id is conclusive only when nothing local
   * owns it. With a local owner, `GET /api/workflows/{id}` decides, because the
   * listing hides version-less drafts.
   */
  async function resolveRestorationTarget(
    workflowId: string,
    isCurrent: () => boolean
  ): Promise<RestorationOutcome> {
    const listed = await refreshCloudWorkflowIds()
    if (!isCurrent()) return { outcome: 'superseded' }
    const target =
      boundOrOpenWorkflowFor(workflowId) ?? storedWorkflowFor(workflowId)
    if (!listed || !cloudListingOmits(workflowId))
      return {
        outcome: 'open',
        target,
        listed: listed && cloudListingIncludes(workflowId)
      }
    if (target === null) return { outcome: 'deleted' }
    const lifecycle = await cloudWorkflowLifecycle(workflowId)
    if (!isCurrent()) return { outcome: 'superseded' }
    return restorationOutcomeFor(
      lifecycle,
      boundOrOpenWorkflowFor(workflowId) ?? storedWorkflowFor(workflowId)
    )
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
      // The listing leaves out workflows a local host has not named yet, so
      // its copy is the last word on whether the workflow still exists.
      const reopened = await reopenFromHost(workflowId, isCurrent)
      if (reopened !== null) return reopened
      panelStore.markWorkflowTargetUnavailable()
      return true
    }
    return openRestoredWorkflow(
      resolved.target,
      workflowId,
      isCurrent,
      resolved.listed
    )
  }

  /**
   * `listed` says the workflow listing names this workflow. One that is still
   * not found after a fresh sync then has no saved copy this browser can open
   * (an unsaved tab in another browser, or a name shared by two saved
   * workflows), so retrying cannot help: the chat opens without it.
   */
  async function openRestoredWorkflow(
    target: ComfyWorkflow | null,
    workflowId: string,
    isCurrent: () => boolean,
    listed = false
  ): Promise<boolean> {
    try {
      if (target === null) {
        await workflowStore.syncWorkflows()
        if (!isCurrent()) return false
        target = storedWorkflowFor(workflowId)
      }
      if (target === null && listed) {
        const reopened = await reopenFromHost(workflowId, isCurrent)
        if (reopened !== null) return reopened
        panelStore.markWorkflowTargetUnavailable()
        return true
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

  /**
   * Opens the host's copy of the workflow in a new tab bound to the chat.
   * Null when there is no copy or it does not open, so the caller falls back
   * to marking the workflow unavailable.
   */
  async function reopenFromHost(
    workflowId: string,
    isCurrent: () => boolean
  ): Promise<boolean | null> {
    if (!loadHostWorkflow) return null
    const data = await loadHostWorkflow(workflowId).catch(() => null)
    if (!isCurrent()) return false
    if (data === null) return null
    const name = listedNameFor(workflowId) ?? 'Unsaved Workflow'
    // The host's copy keeps another browser's camera, which can leave every
    // node off screen here; without one the load fits the view.
    const { ds: _camera, ...extra } = data.extra ?? {}
    const tab = workflowStore.createTemporary(`${name}.json`, {
      ...data,
      extra
    })
    const opened = await workflowService.openWorkflow(tab, { isCurrent })
    if (!isCurrent()) return false
    if (!opened) return null
    commitWorkflowTarget(tab, workflowId, 'restored')
    return true
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
