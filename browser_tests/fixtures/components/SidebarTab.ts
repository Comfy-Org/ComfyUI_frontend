import { Locator, Page } from '@playwright/test'

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
}

export class NodeLibrarySidebarTab extends SidebarTab {
  constructor(public readonly page: Page) {
    super(page, 'node-library')
  }

  get nodeLibrarySearchBoxInput() {
    return this.page.locator('.node-lib-search-box input[type="text"]')
  }

  get nodeLibraryTree() {
    return this.page.locator('.node-lib-tree-explorer')
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

  async open() {
    await super.open()
    await this.nodeLibraryTree.waitFor({ state: 'visible' })
  }

  async close() {
    if (!this.tabButton.isVisible()) {
      return
    }

    await this.tabButton.click()
    await this.nodeLibraryTree.waitFor({ state: 'hidden' })
  }

  folderSelector(folderName: string) {
    return `.p-tree-node-content:has(> .tree-explorer-node-label:has(.tree-folder .node-label:has-text("${folderName}")))`
  }

  getFolder(folderName: string) {
    return this.page.locator(this.folderSelector(folderName))
  }

  nodeSelector(nodeName: string) {
    return `.p-tree-node-content:has(> .tree-explorer-node-label:has(.tree-leaf .node-label:has-text("${nodeName}")))`
  }

  getNode(nodeName: string) {
    return this.page.locator(this.nodeSelector(nodeName))
  }
}

export class WorkflowsSidebarTab extends SidebarTab {
  constructor(public readonly page: Page) {
    super(page, 'workflows')
  }

  get browseGalleryButton() {
    return this.page.locator('.browse-templates-button')
  }

  get newBlankWorkflowButton() {
    return this.page.locator('.new-blank-workflow-button')
  }

  get openWorkflowButton() {
    return this.page.locator('.open-workflow-button')
  }

  async getOpenedWorkflowNames() {
    return await this.page
      .locator('.comfyui-workflows-open .node-label')
      .allInnerTexts()
  }

  async getActiveWorkflowName() {
    return await this.page
      .locator('.comfyui-workflows-open .p-tree-node-selected .node-label')
      .innerText()
  }

  async getTopLevelSavedWorkflowNames() {
    return await this.page
      .locator('.comfyui-workflows-browse .node-label')
      .allInnerTexts()
  }

  async switchToWorkflow(workflowName: string) {
    const workflowLocator = this.getOpenedItem(workflowName)
    await workflowLocator.click()
    await this.page.waitForTimeout(300)
  }

  getOpenedItem(name: string) {
    return this.page.locator('.comfyui-workflows-open .node-label', {
      hasText: name
    })
  }

  getPersistedItem(name: string) {
    return this.page.locator('.comfyui-workflows-browse .node-label', {
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
    await this.page.waitForTimeout(300)
  }
}
