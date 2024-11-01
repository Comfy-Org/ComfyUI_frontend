import { ComfyAsyncDialog } from '@/scripts/ui/components/asyncDialog'
import { ComfyWorkflow, useWorkflowStore } from '@/stores/workflowStore'
import { showPromptDialog } from './dialogService'
import { app } from '@/scripts/app'

// TODO(huchenlei): Auto Error Handling for all methods.
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
    await app.loadGraphData()
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
  ): Promise<void> {
    if (!workflow.isLoaded) {
      return
    }

    if (workflow.isModified && options.warnIfUnsaved) {
      const res = (await ComfyAsyncDialog.prompt({
        title: 'Save Changes?',
        message: `Do you want to save changes to "${workflow.path}" before closing?`,
        actions: ['Yes', 'No', 'Cancel']
      })) as 'Yes' | 'No' | 'Cancel'

      if (res === 'Yes') {
        await this.saveWorkflow(workflow)
      } else if (res === 'Cancel') {
        return
      }
    }

    await workflow.close()
  },

  // Note: this method is used primarily for loadGraphData to create temporary
  // workflows.
  async setWorkflow(value: string | ComfyWorkflow | null) {
    const workflowStore = useWorkflowStore()
    if (typeof value === 'string') {
      const workflow = workflowStore.workflowLookup['workflows/' + value]
      if (workflow) {
        await workflowStore.openWorkflow(workflow, { skipGraphLoad: true })
        return
      }
    }

    if (value === null || typeof value === 'string') {
      const path = value as string | null
      const tempWorkflow = workflowStore.createTemporary(path ?? undefined)
      await workflowStore.openWorkflow(tempWorkflow, { skipGraphLoad: true })
      return
    }

    // value is a ComfyWorkflow, do nothing as ComfyWorkflow.open calls
    // loadGraphData internally.
  }
}
