import { ComfyAsyncDialog } from '@/scripts/ui/components/asyncDialog'
import { ComfyWorkflow, useWorkflowStore } from '@/stores/workflowStore'
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
    this.setWorkflow(null)
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
  ): Promise<void> {
    if (!workflow.isLoaded) {
      return
    }

    if (workflow.isModified && options.warnIfUnsaved) {
      const res = await ComfyAsyncDialog.prompt({
        title: 'Save Changes?',
        message: `Do you want to save changes to "${workflow.path}" before closing?`,
        actions: ['Yes', 'No', 'Cancel']
      })

      if (res === 'Yes') {
        await this.saveWorkflow(workflow)
      } else if (res === 'Cancel') {
        return
      }
    }

    await workflow.close()
  },

  /**
   * Open a workflow from a file path
   * @param path The path to the workflow file. Will be prefixed with 'workflows/'
   */
  async openWorkflowFromFilePath(path: string) {
    const workflowStore = useWorkflowStore()
    const workflow = workflowStore.workflowLookup['workflows/' + path]
    if (workflow) {
      await workflow.load()
    }
  },

  async setWorkflow(value: string | ComfyWorkflow | null) {
    const workflowStore = useWorkflowStore()
    if (value === null) {
      return
    }

    if (typeof value === 'string') {
      const workflow = workflowStore.workflowLookup['workflows/' + value]
      if (workflow) {
        await workflow.open()
        return
      }
    }

    const workflow = workflowStore.createTemporary()
    await workflow.open()
  }
}
