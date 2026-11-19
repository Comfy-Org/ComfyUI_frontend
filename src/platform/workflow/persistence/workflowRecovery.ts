import { isEqual } from 'es-toolkit'

import type { ComfyWorkflowJSON } from '@comfyorg/graph-model/workflowSchema'
import { reportError } from '@comfyorg/telemetry/reportError'
import { useSettingStore } from '@/platform/settings/settingStore'
import { canCaptureCanvas } from '@/platform/workflow/core/canvasTrackerOwnership'
import {
  ComfyWorkflow,
  useWorkflowStore
} from '@/platform/workflow/management/stores/workflowStore'
import { useApp } from '@/scripts/appInstance'

import { isStorageAvailable, readOpenPaths } from './base/storageIO'
import { getWorkspaceId } from './base/storageKeys'
import { withWorkflowViewState } from './base/workflowViewState'
import { useWorkflowTabState } from './composables/useWorkflowTabState'
import { useWorkflowDraftStoreV2 } from './stores/workflowDraftStoreV2'

export function checkpointWorkflowRecovery(): boolean {
  const settings = useSettingStore()
  if (!settings.get('Comfy.Workflow.Persist') || !isStorageAvailable())
    return false

  const workflowStore = useWorkflowStore()
  const active: ComfyWorkflow | null = workflowStore.activeWorkflow
  const activeTracker = active?.changeTracker
  if (!active || !activeTracker || !canCaptureCanvas(activeTracker))
    return false

  const paths = workflowStore.openWorkflows
    .map((workflow) => workflow.path)
    .filter((path) => path.startsWith(ComfyWorkflow.basePath))
  const activeIndex = paths.indexOf(active.path)
  if (
    activeIndex < 0 ||
    workflowStore.modifiedWorkflows.some(
      (workflow) => !paths.includes(workflow.path)
    )
  )
    return false

  const draftStore = useWorkflowDraftStoreV2()
  if (draftStore.isPersistencePaused()) return false
  const tabState = useWorkflowTabState()
  const restoreView = {
    enabled: settings.get('Comfy.EnableWorkflowViewRestore')
  }

  try {
    const snapshots = workflowStore.modifiedWorkflows.map((workflow) => {
      const isActive = workflow.path === active.path
      const graph = isActive
        ? (useApp().rootGraph.serialize() as unknown as ComfyWorkflowJSON)
        : workflow.activeState
      const view = isActive
        ? useApp().canvasOrUndefined?.ds
        : workflow.changeTracker?.ds
      return {
        workflow,
        data: graph
          ? JSON.stringify(withWorkflowViewState(graph, view, restoreView))
          : null
      }
    })
    const current = snapshots.find(
      ({ workflow }) => workflow.path === active.path
    )
    if (
      current &&
      (current.data === null ||
        !draftStore.saveDraft(
          active.path,
          current.data,
          {
            name: active.key,
            isTemporary: active.isTemporary,
            isModified: active.isModified
          },
          { evict: false }
        ))
    )
      return false

    tabState.setOpenPaths(paths, activeIndex)
    const expected = { paths, activeIndex }
    if (
      !isEqual(tabState.getOpenPaths(), expected) ||
      !isEqual(readOpenPaths(null, getWorkspaceId()), {
        workspaceId: getWorkspaceId(),
        ...expected
      })
    )
      return false

    return snapshots.every(({ workflow, data }) => {
      const draft = draftStore.getDraft(workflow.path, { fresh: true })
      return (
        data !== null &&
        draft?.data === data &&
        draft.name === workflow.key &&
        draft.isTemporary === workflow.isTemporary &&
        draft.isModified !== false &&
        draft.updatedAt >= workflow.lastModified
      )
    })
  } catch (error) {
    reportError(error, {
      surface: 'graph',
      errorType: 'error_persisting_workflow_recovery'
    })
    return false
  }
}
