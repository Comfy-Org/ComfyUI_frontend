import { isEqual } from 'es-toolkit'

import { reportError } from '@comfyorg/telemetry/reportError'
import { useSettingStore } from '@/platform/settings/settingStore'
import {
  ComfyWorkflow,
  useWorkflowStore
} from '@/platform/workflow/management/stores/workflowStore'
import { useApp } from '@/scripts/appInstance'

import { isStorageAvailable, readOpenPaths } from './base/storageIO'
import { getWorkspaceId } from './base/storageKeys'
import { useWorkflowTabState } from './composables/useWorkflowTabState'
import { useWorkflowDraftStoreV2 } from './stores/workflowDraftStoreV2'

export function checkpointWorkflowRecovery(): boolean {
  if (!useSettingStore().get('Comfy.Workflow.Persist') || !isStorageAvailable())
    return false

  const workflowStore = useWorkflowStore()
  const active = workflowStore.activeWorkflow
  if (!active) return false

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
  const tabState = useWorkflowTabState()

  try {
    const snapshots = workflowStore.modifiedWorkflows.map((workflow) => {
      const graph =
        workflow.path === active.path
          ? useApp().rootGraph.serialize()
          : workflow.activeState
      return { workflow, data: graph ? JSON.stringify(graph) : null }
    })
    const current = snapshots.find(
      ({ workflow }) => workflow.path === active.path
    )
    if (
      current?.data &&
      !draftStore.saveDraft(active.path, current.data, {
        name: active.key,
        isTemporary: active.isTemporary
      })
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
