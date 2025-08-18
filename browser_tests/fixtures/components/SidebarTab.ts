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
  async close() {
    if (!this.tabButton.isVisible()) {
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

  async insertWorkflow(locator: Locator) {
    await locator.click({ button: 'right' })
    await this.page
      .locator('.p-contextmenu-item-content', { hasText: 'Insert' })
      .click()
  }
}

export class QueueSidebarTab extends SidebarTab {
  constructor(public readonly page: Page) {
    super(page, 'queue')
  }

  get root() {
    return this.page.locator('.sidebar-content-container', { hasText: 'Queue' })
  }

  get tasks() {
    return this.root.locator('[data-virtual-grid-item]')
  }

  get visibleTasks() {
    return this.tasks.locator('visible=true')
  }

  get clearButton() {
    return this.root.locator('.clear-all-button')
  }

  get collapseTasksButton() {
    return this.getToggleExpandButton(false)
  }

  get expandTasksButton() {
    return this.getToggleExpandButton(true)
  }

  get noResultsPlaceholder() {
    return this.root.locator('.no-results-placeholder')
  }

  get galleryImage() {
    return this.page.locator('.galleria-image')
  }

  private getToggleExpandButton(isExpanded: boolean) {
    const iconSelector = isExpanded ? '.pi-image' : '.pi-images'
    return this.root.locator(`.toggle-expanded-button ${iconSelector}`)
  }

  async open() {
    await super.open()
    return this.root.waitFor({ state: 'visible' })
  }

  async close() {
    await super.close()
    await this.root.waitFor({ state: 'hidden' })
  }

  async expandTasks() {
    await this.expandTasksButton.click()
    await this.collapseTasksButton.waitFor({ state: 'visible' })
  }

  async collapseTasks() {
    await this.collapseTasksButton.click()
    await this.expandTasksButton.waitFor({ state: 'visible' })
  }

  async waitForTasks() {
    return Promise.all([
      this.tasks.first().waitFor({ state: 'visible' }),
      this.tasks.last().waitFor({ state: 'visible' })
    ])
  }

  async scrollTasks(direction: 'up' | 'down') {
    const scrollToEl =
      direction === 'up' ? this.tasks.last() : this.tasks.first()
    await scrollToEl.scrollIntoViewIfNeeded()
    await this.waitForTasks()
  }

  async clearTasks() {
    await this.clearButton.click()
    const confirmButton = this.page.getByLabel('Delete')
    await confirmButton.click()
    await this.noResultsPlaceholder.waitFor({ state: 'visible' })
  }

  /** Set the width of the tab (out of 100). Must call before opening the tab */
  async setTabWidth(width: number) {
    if (width < 0 || width > 100) {
      throw new Error('Width must be between 0 and 100')
    }
    return this.page.evaluate((width) => {
      localStorage.setItem('queue', JSON.stringify([width, 100 - width]))
    }, width)
  }

  getTaskPreviewButton(taskIndex: number) {
    return this.tasks.nth(taskIndex).getByRole('button')
  }

  async openTaskPreview(taskIndex: number) {
    const previewButton = this.getTaskPreviewButton(taskIndex)
    await previewButton.click()
    return this.galleryImage.waitFor({ state: 'visible' })
  }

  getGalleryImage(imageFilename: string) {
    return this.galleryImage.and(this.page.getByAltText(imageFilename))
  }

  getTaskImage(imageFilename: string) {
    return this.tasks.getByAltText(imageFilename)
  }

  /** Trigger the queue store and tasks to update */
  async triggerTasksUpdate() {
    await this.page.evaluate(() => {
      window['app']['api'].dispatchCustomEvent('status', {
        exec_info: { queue_remaining: 0 }
      })
    })
  }
}
