import { readFileSync } from 'fs'

import type { ComfyPage } from '../ComfyPage'

export type FolderStructure = {
  [key: string]: FolderStructure | string
}

export class WorkflowHelper {
  constructor(private readonly comfyPage: ComfyPage) {}

  convertLeafToContent(structure: FolderStructure): FolderStructure {
    const result: FolderStructure = {}

    for (const [key, value] of Object.entries(structure)) {
      if (typeof value === 'string') {
        const filePath = this.comfyPage.assetPath(value)
        result[key] = readFileSync(filePath, 'utf-8')
      } else {
        result[key] = this.convertLeafToContent(value)
      }
    }

    return result
  }

  async setupWorkflowsDirectory(structure: FolderStructure) {
    const resp = await this.comfyPage.request.post(
      `${this.comfyPage.url}/api/devtools/setup_folder_structure`,
      {
        data: {
          tree_structure: this.convertLeafToContent(structure),
          base_path: `user/${this.comfyPage.id}/workflows`
        }
      }
    )

    if (resp.status() !== 200) {
      throw new Error(
        `Failed to setup workflows directory: ${await resp.text()}`
      )
    }

    await this.comfyPage.page.evaluate(async () => {
      await window['app'].extensionManager.workflow.syncWorkflows()
    })

    // Wait for Vue to re-render the workflow list
    await this.comfyPage.nextFrame()
  }

  async loadWorkflow(workflowName: string) {
    await this.comfyPage.workflowUploadInput.setInputFiles(
      this.comfyPage.assetPath(`${workflowName}.json`)
    )
    await this.comfyPage.nextFrame()
  }

  async deleteWorkflow(
    workflowName: string,
    whenMissing: 'ignoreMissing' | 'throwIfMissing' = 'ignoreMissing'
  ) {
    // Open workflows tab
    const { workflowsTab } = this.comfyPage.menu
    await workflowsTab.open()

    // Action to take if workflow missing
    if (whenMissing === 'ignoreMissing') {
      const workflows = await workflowsTab.getTopLevelSavedWorkflowNames()
      if (!workflows.includes(workflowName)) return
    }

    // Delete workflow
    await workflowsTab.getPersistedItem(workflowName).click({ button: 'right' })
    await this.comfyPage.contextMenu.clickMenuItem('Delete')
    await this.comfyPage.nextFrame()
    await this.comfyPage.confirmDialog.delete.click()

    // Clear toast & close tab
    await this.comfyPage.closeToasts(1)
    await workflowsTab.close()
  }
}
