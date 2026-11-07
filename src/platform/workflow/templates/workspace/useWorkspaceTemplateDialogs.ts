import { defineAsyncComponent } from 'vue'

import { useToast } from '@/components/ui/toast/toastStore'
import { t } from '@/i18n'
import type { ComfyWorkflow } from '@/platform/workflow/management/stores/workflowStore'
import { useDialogService } from '@/services/dialogService'
import { useDialogStore } from '@/stores/dialogStore'
import { useNodeDefStore } from '@/stores/nodeDefStore'

import { WORKSPACE_TEMPLATE_FORM_DIALOG_KEY } from './workspaceTemplateDialogKeys'
import { deriveWorkspaceTemplateRequirements } from './workspaceTemplateRequirements'
import { useWorkspaceTemplatesStore } from './workspaceTemplatesStore'

const WorkspaceTemplateFormDialog = defineAsyncComponent(
  () => import('./components/WorkspaceTemplateFormDialog.vue')
)

export function useWorkspaceTemplateDialogs() {
  const dialogStore = useDialogStore()
  const dialogService = useDialogService()
  const nodeDefStore = useNodeDefStore()
  const workspaceTemplatesStore = useWorkspaceTemplatesStore()
  const toast = useToast()

  function showAddDialog(workflow: ComfyWorkflow) {
    const workflowJson = workflow.activeState
    if (!workflowJson) {
      toast.error(t('workspaceTemplates.errors.noWorkflow'), {
        duration: 3000
      })
      return
    }
    dialogStore.showDialog({
      key: WORKSPACE_TEMPLATE_FORM_DIALOG_KEY,
      component: WorkspaceTemplateFormDialog,
      props: {
        mode: 'add',
        initialTitle: workflow.filename,
        workflow: workflowJson,
        requirements: deriveWorkspaceTemplateRequirements(
          workflowJson,
          (nodeType) => nodeDefStore.nodeDefsByName[nodeType]
        )
      },
      dialogComponentProps: { headless: true }
    })
  }

  function showEditDialog(templateId: string) {
    const template = workspaceTemplatesStore.findTemplate(templateId)
    if (!template) return
    dialogStore.showDialog({
      key: WORKSPACE_TEMPLATE_FORM_DIALOG_KEY,
      component: WorkspaceTemplateFormDialog,
      props: {
        mode: 'edit',
        templateId,
        initialTitle: template.title,
        initialDescription: template.description
      },
      dialogComponentProps: { headless: true }
    })
  }

  async function confirmDelete(templateId: string) {
    const template = workspaceTemplatesStore.findTemplate(templateId)
    if (!template) return
    const confirmed = await dialogService.confirm({
      title: t('workspaceTemplates.deleteConfirmTitle'),
      message: t('workspaceTemplates.deleteConfirmMessage', {
        title: template.title
      }),
      type: 'delete'
    })
    if (confirmed) await workspaceTemplatesStore.deleteTemplate(templateId)
  }

  return { showAddDialog, showEditDialog, confirmDelete }
}
