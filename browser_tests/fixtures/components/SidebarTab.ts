import type { Locator, Page } from '@playwright/test'

import type { WorkspaceStore } from '../../types/globals'
import { TestIds } from '../selectors'

class SidebarTab {
  constructor(
    public readonly page: Page,
    public readonly tabId: string
  ) {}

  get tabButton() {
    return this.page.locator(`.${this.tabId}-tab-button`)
  }

  get selectedTabButton() {
    return this.page.locator(
      `.${this.tabId}-tab-button.side-bar-button-selected`
    )
  }

  async open() {
    if (await this.selectedTabButton.isVisible()) {
      return
    }
    await this.tabButton.click()
  }
  async close() {
    if (!this.tabButton.isVisible()) {
      return
    }
    await this.tabButton.click()
  }
}

export class NodeLibrarySidebarTab extends SidebarTab {
  constructor(public override readonly page: Page) {
    super(page, 'node-library')
  }

  get nodeLibrarySearchBoxInput() {
    return this.page.getByPlaceholder('Search Nodes...')
  }

  get nodeLibraryTree() {
    return this.page.getByTestId(TestIds.sidebar.nodeLibrary)
  }

  get nodePreview() {
    return this.page.locator('.node-lib-node-preview')
  }

  get tabContainer() {
    return this.page.locator('.sidebar-content-container')
  }

  get newFolderButton() {
    return this.tabContainer.locator('.new-folder-button')
  }

  override async open() {
    await super.open()
    await this.nodeLibraryTree.waitFor({ state: 'visible' })
  }

  override async close() {
    if (!this.tabButton.isVisible()) {
      return
    }

    await this.tabButton.click()
    await this.nodeLibraryTree.waitFor({ state: 'hidden' })
  }

  getFolder(folderName: string) {
    return this.page.locator(
      `[data-testid="node-tree-folder"][data-folder-name="${folderName}"]`
    )
  }

  getNode(nodeName: string) {
    return this.page.locator(
      `[data-testid="node-tree-leaf"][data-node-name="${nodeName}"]`
    )
  }

  nodeSelector(nodeName: string): string {
    return `[data-testid="node-tree-leaf"][data-node-name="${nodeName}"]`
  }

  folderSelector(folderName: string): string {
    return `[data-testid="node-tree-folder"][data-folder-name="${folderName}"]`
  }

  getNodeInFolder(nodeName: string, folderName: string) {
    return this.getFolder(folderName)
      .locator('xpath=ancestor::li')
      .locator(`[data-testid="node-tree-leaf"][data-node-name="${nodeName}"]`)
  }
}

export class WorkflowsSidebarTab extends SidebarTab {
  constructor(public override readonly page: Page) {
    super(page, 'workflows')
  }

  get root() {
    return this.page.getByTestId(TestIds.sidebar.workflows)
  }

  async getOpenedWorkflowNames() {
    return await this.root
      .locator('.comfyui-workflows-open .node-label')
      .allInnerTexts()
  }

  async getActiveWorkflowName() {
    return await this.root
      .locator('.comfyui-workflows-open .p-tree-node-selected .node-label')
      .innerText()
  }

  async getTopLevelSavedWorkflowNames() {
    return await this.root
      .locator('.comfyui-workflows-browse .node-label')
      .allInnerTexts()
  }

  async switchToWorkflow(workflowName: string) {
    const workflowLocator = this.getOpenedItem(workflowName)
    await workflowLocator.click()
  }

  getOpenedItem(name: string) {
    return this.root.locator('.comfyui-workflows-open .node-label', {
      hasText: name
    })
  }

  getPersistedItem(name: string) {
    return this.root.locator('.comfyui-workflows-browse .node-label', {
      hasText: name
    })
  }

  async renameWorkflow(locator: Locator, newName: string) {
    await locator.click({ button: 'right' })
    await this.page
      .locator('.p-contextmenu-item-content', { hasText: 'Rename' })
      .click()
    await this.page.keyboard.type(newName)
    await this.page.keyboard.press('Enter')

    // Wait for workflow service to finish renaming
    await this.page.waitForFunction(
      () =>
        !(window.app?.extensionManager as WorkspaceStore | undefined)?.workflow
          ?.isBusy,
      undefined,
      { timeout: 3000 }
    )
  }

  async insertWorkflow(locator: Locator) {
    await locator.click({ button: 'right' })
    await this.page
      .locator('.p-contextmenu-item-content', { hasText: 'Insert' })
      .click()
  }
}

export class ModelLibrarySidebarTab extends SidebarTab {
  constructor(public override readonly page: Page) {
    super(page, 'model-library')
  }

  get searchInput() {
    return this.page.getByPlaceholder('Search Models...')
  }

  get modelTree() {
    return this.page.locator('.model-lib-tree-explorer')
  }

  get refreshButton() {
    return this.page.getByRole('button', { name: 'Refresh' })
  }

  get loadAllFoldersButton() {
    return this.page.getByRole('button', { name: 'Load All Folders' })
  }

  get folderNodes() {
    return this.modelTree.locator('.p-tree-node:not(.p-tree-node-leaf)')
  }

  get leafNodes() {
    return this.modelTree.locator('.p-tree-node-leaf')
  }

  get modelPreview() {
    return this.page.locator('.model-lib-model-preview')
  }

  override async open() {
    await super.open()
    await this.modelTree.waitFor({ state: 'visible' })
  }

  getFolderByLabel(label: string) {
    return this.modelTree
      .locator('.p-tree-node:not(.p-tree-node-leaf)')
      .filter({ hasText: label })
      .first()
  }

  getLeafByLabel(label: string) {
    return this.modelTree
      .locator('.p-tree-node-leaf')
      .filter({ hasText: label })
      .first()
  }
}

export class AssetsSidebarTab extends SidebarTab {
  constructor(public override readonly page: Page) {
    super(page, 'assets')
  }

  get generatedTab() {
    return this.page.getByRole('tab', { name: 'Generated' })
  }

  get importedTab() {
    return this.page.getByRole('tab', { name: 'Imported' })
  }

  get emptyStateMessage() {
    return this.page.getByText(
      'Upload files or generate content to see them here'
    )
  }

  emptyStateTitle(title: string) {
    return this.page.getByText(title)
  }

  override async open() {
    await super.open()
    await this.generatedTab.waitFor({ state: 'visible' })
  }
}
