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

const PROMPT_KEYS = {
  switch: {
    title: 'deploymentSwitcher.unsaved.title',
    message: 'deploymentSwitcher.unsaved.message',
    deny: 'deploymentSwitcher.unsaved.switchWithoutSaving',
    confirm: 'deploymentSwitcher.unsaved.saveAndSwitch'
  },
  reload: {
    title: 'deploymentSwitcher.unsaved.reloadTitle',
    message: 'deploymentSwitcher.unsaved.reloadMessage',
    deny: 'deploymentSwitcher.unsaved.reloadWithoutSaving',
    confirm: 'deploymentSwitcher.unsaved.saveAndReload'
  }
}

export interface UnsavedWorkPrompt {
  reload?: boolean
}

/** Asks to save unsaved workflows before a switch or reload; false to stay put. */
export async function confirmUnsavedWorkBeforeSwitch(
  deployment: string,
  { reload = false }: UnsavedWorkPrompt = {}
): Promise<boolean> {
  const workflows = unsavedWorkflows()
  if (workflows.length === 0) return true
  const keys = PROMPT_KEYS[reload ? 'reload' : 'switch']
  const confirmed = await useDialogService().confirm({
    title: t(keys.title),
    message: t(keys.message, { deployment }, { escapeParameter: false }),
    type: 'dirtyClose',
    itemList: workflows.map((workflow) => workflow.path),
    hint: useSettingStore().get('Comfy.Workflow.Persist')
      ? t('deploymentSwitcher.unsaved.tabsReturn')
      : undefined,
    denyLabel: t(keys.deny),
    confirmLabel: t(keys.confirm)
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

export function switchReloadNote(): string {
  return useSettingStore().get('Comfy.Workflow.Persist')
    ? t('deploymentSwitcher.switchingNote')
    : t('deploymentSwitcher.switchingNoteWithoutDrafts')
}
