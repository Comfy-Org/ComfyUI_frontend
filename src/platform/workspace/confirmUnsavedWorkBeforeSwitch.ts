import { useErrorHandling } from '@/composables/useErrorHandling'
import { t } from '@/i18n'
import { useSettingStore } from '@/platform/settings/settingStore'
import { useWorkflowService } from '@/platform/workflow/core/services/workflowService'
import type { ComfyWorkflow } from '@/platform/workflow/management/stores/workflowStore'
import { useWorkflowStore } from '@/platform/workflow/management/stores/workflowStore'
import { useDialogService } from '@/services/dialogService'

/** Open workflows with changes a switch reload would leave unsaved. */
export function unsavedWorkflows(): ComfyWorkflow[] {
  return useWorkflowStore().modifiedWorkflows.filter(
    (workflow) => workflow.isLoaded
  )
}

/** Asks to save unsaved workflows before a switch; false to stay put. */
export async function confirmUnsavedWorkBeforeSwitch(
  deployment: string
): Promise<boolean> {
  const workflows = unsavedWorkflows()
  if (workflows.length === 0) return true
  const confirmed = await useDialogService().confirm({
    title: t('deploymentSwitcher.unsaved.title'),
    message: t(
      'deploymentSwitcher.unsaved.message',
      { deployment },
      { escapeParameter: false }
    ),
    type: 'dirtyClose',
    itemList: workflows.map((workflow) => workflow.path),
    hint: useSettingStore().get('Comfy.Workflow.Persist')
      ? t('deploymentSwitcher.unsaved.tabsReturn')
      : undefined,
    denyLabel: t('deploymentSwitcher.unsaved.switchWithoutSaving'),
    confirmLabel: t('deploymentSwitcher.unsaved.saveAndSwitch')
  })
  if (confirmed === null) return false
  if (!confirmed) return true
  const workflowService = useWorkflowService()
  const save = useErrorHandling().wrapWithErrorHandlingAsync(
    (workflow: ComfyWorkflow) => workflowService.saveWorkflow(workflow)
  )
  for (const workflow of workflows) {
    if ((await save(workflow)) !== true) return false
  }
  return true
}
