import { useErrorHandling } from '@/composables/useErrorHandling'
import { t } from '@/i18n'
import { useSettingStore } from '@/platform/settings/settingStore'
import { useWorkflowService } from '@/platform/workflow/core/services/workflowService'
import type { ComfyWorkflow } from '@/platform/workflow/management/stores/workflowStore'
import { useWorkflowStore } from '@/platform/workflow/management/stores/workflowStore'
import type { DiscardedWork } from '@/platform/workspace/deploymentSwitchReload'
import {
  NOTHING_DISCARDED,
  discardableState
} from '@/platform/workspace/deploymentSwitchReload'
import { useDialogService } from '@/services/dialogService'

function changedWhileSaving(workflow: ComfyWorkflow): boolean {
  return (
    workflow.activeState !== null &&
    workflow.content !== JSON.stringify(workflow.activeState)
  )
}

function keepUnsentEditsUnsaved(workflow: ComfyWorkflow) {
  if (workflow.changeTracker === null || workflow.content === null) return
  workflow.changeTracker.initialState = JSON.parse(workflow.content)
  workflow.isModified = true
}

function captureActiveEdits() {
  useWorkflowStore().activeWorkflow?.changeTracker.prepareForSave()
}

function isStillOpen(workflow: ComfyWorkflow): boolean {
  return (
    workflow.isLoaded &&
    useWorkflowStore().getWorkflowByPath(workflow.path) === workflow
  )
}

/** Loaded workflows a switch reload would lose changes in, counting edits the canvas has not captured yet. */
export function unsavedWorkBeforeSwitch(): ComfyWorkflow[] {
  captureActiveEdits()
  return useWorkflowStore().modifiedWorkflows.filter(
    (workflow) => workflow.isLoaded && workflow.isModified
  )
}

async function saveEach(
  workflows: ComfyWorkflow[]
): Promise<{ saved: ComfyWorkflow[]; complete: boolean }> {
  const workflowService = useWorkflowService()
  const save = useErrorHandling().wrapWithErrorHandlingAsync(
    (workflow: ComfyWorkflow) => workflowService.saveWorkflow(workflow)
  )
  const saved: ComfyWorkflow[] = []
  for (const workflow of workflows) {
    if (!isStillOpen(workflow)) continue
    if ((await save(workflow)) !== true) return { saved, complete: false }
    saved.push(workflow)
  }
  return { saved, complete: true }
}

/**
 * Asks to save modified workflows before a deployment switch reloads the tab.
 * Resolves to the work the user chose to drop, or null when they cancelled or a save did not finish.
 */
export async function settleUnsavedWorkBeforeSwitch(
  deployment: string
): Promise<DiscardedWork | null> {
  return settleWorkflows(deployment, unsavedWorkBeforeSwitch())
}

async function settleWorkflows(
  deployment: string,
  modified: ComfyWorkflow[]
): Promise<DiscardedWork | null> {
  if (modified.length === 0) return NOTHING_DISCARDED
  const choice = await useDialogService().confirm({
    title: t('deploymentSwitcher.unsaved.title'),
    message: t(
      'deploymentSwitcher.unsaved.message',
      { deployment },
      { escapeParameter: false }
    ),
    type: 'dirtyClose',
    itemList: modified.map((workflow) => workflow.key),
    hint: useSettingStore().get('Comfy.Workflow.Persist')
      ? t('deploymentSwitcher.unsaved.tabsReturn')
      : undefined,
    denyLabel: t('deploymentSwitcher.unsaved.switchWithoutSaving'),
    confirmLabel: t('deploymentSwitcher.unsaved.saveAndSwitch')
  })
  if (choice === null) return null
  if (!choice) {
    return new Map(
      modified.map((workflow) => [workflow, discardableState(workflow)])
    )
  }
  const { saved, complete } = await saveEach(modified)
  captureActiveEdits()
  for (const workflow of saved.filter(changedWhileSaving)) {
    keepUnsentEditsUnsaved(workflow)
  }
  if (!complete) return null
  return settleWorkflows(deployment, unsavedWorkBeforeSwitch())
}
