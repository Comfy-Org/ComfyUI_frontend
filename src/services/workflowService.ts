import { ComfyAsyncDialog } from '@/scripts/ui/components/asyncDialog'
import { useWorkflowStore } from '@/stores/workflowStore'
import type { ComfyWorkflow } from '@/stores/workflowStore'
import { showPromptDialog } from './dialogService'
import { app } from '@/scripts/app'

export const workflowService = {
  /**
   * Save a workflow as a new file
   * @param workflow The workflow to save
   */
  async saveWorkflowAs(workflow: ComfyWorkflow) {
    const newFilename = await showPromptDialog({
      title: 'Save workflow',
      message: 'Enter the filename:',
      defaultValue: workflow.filename
    })
    if (!newFilename) return
    await workflow.saveAs(workflow.directory + '/' + newFilename)
  },

  /**
   * Save a workflow
   * @param workflow The workflow to save
   */
  async saveWorkflow(workflow: ComfyWorkflow) {
    if (workflow.isTemporary) {
      await this.saveWorkflowAs(workflow)
    } else {
      await workflow.save()
    }
  },

  /**
   * Load the default workflow
   */
  async loadDefaultWorkflow() {
    await app.loadGraphData()
  },

  /**
   * Load a blank workflow
   */
  async loadBlankWorkflow() {
    app.workflowManager.setWorkflow(null)
    app.clean()
    app.graph.clear()
  },

  /**
   * Close a workflow with confirmation if there are unsaved changes
   * @param workflow The workflow to close
   * @returns true if the workflow was closed, false if the user cancelled
   */
  async closeWorkflow(
    workflow: ComfyWorkflow,
    options: { warnIfUnsaved: boolean } = { warnIfUnsaved: true }
  ): Promise<boolean> {
    if (!workflow.isLoaded) {
      return true
    }

    const workflowStore = useWorkflowStore()
    if (workflow.isModified && options.warnIfUnsaved) {
      const res = await ComfyAsyncDialog.prompt({
        title: 'Save Changes?',
        message: `Do you want to save changes to "${workflow.path}" before closing?`,
        actions: ['Yes', 'No', 'Cancel']
      })
      if (res === 'Yes') {
        const active = this.activeWorkflow
        if (active !== workflow) {
          // We need to switch to the workflow to save it
          await workflow.load()
        }

        if (!(await workflow.save())) {
          // Save was canceled, restore the previous workflow
          if (active !== workflow) {
            await active.load()
          }
          return
        }
      } else if (res === 'Cancel') {
        return
      }
    }
    if (this.openWorkflows.length > 0) {
      this._activeWorkflow = this.openWorkflows[0]
      await this._activeWorkflow.load()
    } else {
      // Load default
      await this.app.loadGraphData()
    }
  }
}
