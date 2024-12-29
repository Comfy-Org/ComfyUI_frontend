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

  get root() {
    return this.page.locator('.workflows-sidebar-tab')
  }

  get browseGalleryButton() {
    return this.root.locator('.browse-templates-button')
  }

  get newBlankWorkflowButton() {
    return this.root.locator('.new-blank-workflow-button')
  }

  get openWorkflowButton() {
    return this.root.locator('.open-workflow-button')
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
    await this.page.waitForTimeout(300)
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
    await this.page.waitForTimeout(300)
  }
}

export class QueueSidebarTab extends SidebarTab {
  constructor(public readonly page: Page) {
    super(page, 'queue')
  }

  get root() {
    return this.page.locator('.sidebar-content-container', { hasText: 'Queue' })
  }

  get clearButton() {
    return this.root.locator('.clear-all-button')
  }

  get scrollContainer() {
    return this.root.locator('.scroll-container')
  }

  get placeholder() {
    return this.root.locator('.no-results-placeholder')
  }

  get tasks() {
    return this.scrollContainer.locator('[data-virtual-grid-item]')
  }

  get visibleTasks() {
    return this.scrollContainer
      .locator('[data-virtual-grid-item]')
      .locator('visible=true')
  }

  async open() {
    await super.open()
    await this.root.waitFor({ state: 'visible' })
  }

  async close() {
    if (!this.tabButton.isVisible()) {
      return
    }
    await this.tabButton.click()
    await this.root.waitFor({ state: 'hidden' })
  }

  async waitForMostRecentTask() {
    return Promise.all([
      this.tasks.first().waitFor({ state: 'visible' }),
      this.tasks.first().waitFor({ state: 'attached' })
    ])
  }

  async waitForLeastRecentTask() {
    return Promise.all([
      this.tasks.last().waitFor({ state: 'visible' }),
      this.tasks.last().waitFor({ state: 'attached' })
    ])
  }

  async waitForTasks() {
    return Promise.all([
      this.waitForMostRecentTask(),
      this.waitForLeastRecentTask()
    ])
  }

  async scrollTasksUp() {
    await this.tasks.first().scrollIntoViewIfNeeded()
    await this.waitForMostRecentTask()
    await this.page.waitForTimeout(256)
  }

  async scrollTasksDown() {
    await this.tasks.last().scrollIntoViewIfNeeded()
    await this.waitForLeastRecentTask()
    await this.page.waitForTimeout(256)
  }

  async setWidth(width: number) {
    return this.page.evaluate((width) => {
      localStorage.setItem('queue', JSON.stringify([width, 100 - width]))
    }, width)
  }

  async clearTasks() {
    // Allow delete-history requests
    await this.page.unroute('**/api/history*')

    await this.clearButton.click()
    const confirmButton = this.page.getByLabel('Delete')
    await confirmButton.waitFor({ state: 'visible' })
    await confirmButton.click()
    await this.placeholder.waitFor({ state: 'visible' })
  }
}
