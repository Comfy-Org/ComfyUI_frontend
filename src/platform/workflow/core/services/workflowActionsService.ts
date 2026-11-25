/**
 * Shared workflow actions service
 * Provides reusable workflow operations that can be used by both
 * job menu and media asset actions
 */

import { downloadBlob } from '@/scripts/utils'
import type { ComfyWorkflowJSON } from '@comfyorg/graph-model/workflowSchema'
import { useWorkflowStore } from '@/platform/workflow/management/stores/workflowStore'
import { useWorkflowService } from '@/platform/workflow/core/services/workflowService'
import { useSettingStore } from '@/platform/settings/settingStore'
import { useDialogService } from '@/services/dialogService'
import { isGraphLoadFailurePresented } from '@/services/graphLoadFailure'
import { appendJsonExt } from '@/utils/formatUtil'
import { t } from '@/i18n'

/** Outcome of opening a workflow; `handled` means the loader already showed the failure. */
export interface WorkflowOpenResult {
  success: boolean
  error?: string
  errorPresentation?: 'handled'
}

/**
 * Provides shared workflow actions
 * These operations are used by multiple contexts (jobs, assets)
 * to avoid code duplication while maintaining flexibility
 */
export function useWorkflowActionsService() {
  const workflowStore = useWorkflowStore()
  const workflowService = useWorkflowService()
  const settingStore = useSettingStore()
  const dialogService = useDialogService()

  /**
   * Export workflow as JSON file with optional filename prompt
   *
   * @param workflow The workflow data to export
   * @param defaultFilename Default filename to use
   * @returns Result of the export operation
   *
   * @example
   * const result = await exportWorkflowAction(workflow, 'MyWorkflow.json')
   * if (result.success) {
   *   toast.success('Exported!')
   * }
   */
  const exportWorkflowAction = async (
    workflow: ComfyWorkflowJSON | null,
    defaultFilename: string
  ): Promise<{
    success: boolean
    cancelled?: boolean
    error?: string
  }> => {
    if (!workflow) {
      return { success: false, error: 'No workflow data available' }
    }

    try {
      let filename = defaultFilename

      // Optionally prompt for custom filename
      if (settingStore.get('Comfy.PromptFilename')) {
        const input = await dialogService.prompt({
          title: t('workflowService.exportWorkflow'),
          message: t('workflowService.enterFilenamePrompt'),
          defaultValue: filename
        })
        // User cancelled the prompt
        if (!input) return { success: false, cancelled: true }
        filename = appendJsonExt(input)
      }

      // Convert workflow to formatted JSON
      const json = JSON.stringify(workflow, null, 2)
      const blob = new Blob([json], { type: 'application/json' })
      downloadBlob(filename, blob)

      return { success: true }
    } catch (error) {
      return {
        success: false,
        error:
          error instanceof Error ? error.message : 'Failed to export workflow'
      }
    }
  }

  /**
   * Open workflow in new tab
   * Creates a temporary workflow and opens it via the workflow service
   *
   * @param workflow The workflow data to open
   * @param filename Filename for the temporary workflow
   * @returns Result of the open operation
   *
   * @example
   * const result = await openWorkflowAction(workflow, 'Job 123.json')
   * if (!result.success) {
   *   toast.error(result.error)
   * }
   */
  const openWorkflowAction = async (
    workflow: ComfyWorkflowJSON | null,
    filename: string
  ): Promise<WorkflowOpenResult> => {
    if (!workflow) {
      return { success: false, error: 'No workflow data available' }
    }

    try {
      const temp = workflowStore.createTemporary(filename, workflow)
      const opened = await workflowService.openWorkflow(temp)
      if (opened) return { success: true }
      return { success: false, errorPresentation: 'handled' }
    } catch (error) {
      return {
        success: false,
        error:
          error instanceof Error ? error.message : 'Failed to open workflow',
        errorPresentation: isGraphLoadFailurePresented(error)
          ? 'handled'
          : undefined
      }
    }
  }

  return {
    exportWorkflowAction,
    openWorkflowAction
  }
}
