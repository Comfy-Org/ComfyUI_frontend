import { readFileSync } from 'fs'

import { test } from '@playwright/test'

import type { AppMode } from '@/composables/useAppMode'
import type {
  ComfyApiWorkflow,
  ComfyWorkflowJSON
} from '@/platform/workflow/validation/schemas/workflowSchema'
import type { WorkspaceStore } from '@e2e/types/globals'
import type { ComfyPage } from '@e2e/fixtures/ComfyPage'
import { assetPath } from '@e2e/fixtures/utils/paths'

type FolderStructure = {
  [key: string]: FolderStructure | string
}

export class WorkflowHelper {
  constructor(private readonly comfyPage: ComfyPage) {}

  convertLeafToContent(structure: FolderStructure): FolderStructure {
    const result: FolderStructure = {}

    for (const [key, value] of Object.entries(structure)) {
      if (typeof value === 'string') {
        const filePath = assetPath(value)
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
      await (
        window.app!.extensionManager as WorkspaceStore
      ).workflow.syncWorkflows()
    })

    // Wait for Vue to re-render the workflow list
    await this.comfyPage.nextFrame()
  }

  async waitForDraftPersisted({ timeout = 5000 } = {}) {
    await this.comfyPage.page.waitForFunction(
      () =>
        Object.keys(localStorage).some((k) =>
          k.startsWith('Comfy.Workflow.Draft.v2:')
        ),
      { timeout }
    )
  }

  async loadWorkflow(workflowName: string) {
    await this.comfyPage.workflowUploadInput.setInputFiles(
      assetPath(`${workflowName}.json`)
    )
    await this.comfyPage.nextFrame()
    if (test.info().tags.includes('@vue-nodes')) {
      await this.comfyPage.vueNodes.waitForNodes()
    }
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
    await this.comfyPage.toast.closeToasts(1)
    await workflowsTab.close()
  }

  async getUndoQueueSize(): Promise<number | undefined> {
    return this.comfyPage.page.evaluate(() => {
      const workflow = (window.app!.extensionManager as WorkspaceStore).workflow
        .activeWorkflow
      return workflow?.changeTracker.undoQueue.length
    })
  }

  async getRedoQueueSize(): Promise<number | undefined> {
    return this.comfyPage.page.evaluate(() => {
      const workflow = (window.app!.extensionManager as WorkspaceStore).workflow
        .activeWorkflow
      return workflow?.changeTracker.redoQueue.length
    })
  }

  async waitForActiveWorkflow(): Promise<void> {
    await this.comfyPage.page.waitForFunction(
      () =>
        (window.app!.extensionManager as WorkspaceStore).workflow
          .activeWorkflow !== null
    )
  }

  async getActiveWorkflowPath(): Promise<string | undefined> {
    return this.comfyPage.page.evaluate(() => {
      return (window.app!.extensionManager as WorkspaceStore).workflow
        .activeWorkflow?.path
    })
  }

  async getActiveWorkflowActiveAppMode(): Promise<AppMode | null | undefined> {
    return this.comfyPage.page.evaluate(() => {
      return (window.app!.extensionManager as WorkspaceStore).workflow
        .activeWorkflow?.activeMode
    })
  }

  async getActiveWorkflowInitialMode(): Promise<AppMode | null | undefined> {
    return this.comfyPage.page.evaluate(() => {
      return (window.app!.extensionManager as WorkspaceStore).workflow
        .activeWorkflow?.initialMode
    })
  }

  async getLinearModeFromGraph(): Promise<boolean | undefined> {
    return this.comfyPage.page.evaluate(() => {
      return window.app!.rootGraph.extra?.linearMode as boolean | undefined
    })
  }

  async getOpenWorkflowCount(): Promise<number> {
    return this.comfyPage.page.evaluate(() => {
      return (window.app!.extensionManager as WorkspaceStore).workflow.workflows
        .length
    })
  }

  async isCurrentWorkflowModified(): Promise<boolean | undefined> {
    return this.comfyPage.page.evaluate(() => {
      return (window.app!.extensionManager as WorkspaceStore).workflow
        .activeWorkflow?.isModified
    })
  }

  async waitForWorkflowIdle(timeout = 5000): Promise<void> {
    await this.comfyPage.page.waitForFunction(
      () =>
        !(window.app?.extensionManager as WorkspaceStore | undefined)?.workflow
          ?.isBusy,
      undefined,
      { timeout }
    )
  }

  async switchToTab(tabName: string): Promise<void> {
    await this.comfyPage.menu.topbar.getWorkflowTab(tabName).click()
    await this.waitForWorkflowIdle()
  }

  async getExportedWorkflow(options: { api: true }): Promise<ComfyApiWorkflow>
  async getExportedWorkflow(options?: {
    api?: false
  }): Promise<ComfyWorkflowJSON>
  async getExportedWorkflow(options?: {
    api?: boolean
  }): Promise<ComfyWorkflowJSON | ComfyApiWorkflow> {
    const api = options?.api ?? false
    return this.comfyPage.page.evaluate(async (api) => {
      return (await window.app!.graphToPrompt())[api ? 'output' : 'workflow']
    }, api)
  }
}
