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

export class AssetsSidebarTab extends SidebarTab {
  constructor(public override readonly page: Page) {
    super(page, 'assets')
  }

  get root() {
    return this.page.locator('.sidebar-content-container')
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

  get searchInput() {
    return this.root.getByPlaceholder(/Search Assets/i)
  }

  get viewSettingsButton() {
    return this.root.getByLabel('View settings')
  }

  get listViewButton() {
    return this.page.getByRole('button', { name: 'List view' })
  }

  get gridViewButton() {
    return this.page.getByRole('button', { name: 'Grid view' })
  }

  get backButton() {
    return this.page.getByRole('button', { name: 'Back to all assets' })
  }

  get copyJobIdButton() {
    return this.page.getByRole('button', { name: 'Copy job ID' })
  }

  get previewDialog() {
    return this.page.getByRole('dialog', { name: 'Gallery' })
  }

  get selectionCountButton() {
    return this.root.getByRole('button', { name: /Assets Selected:/ })
  }

  get downloadSelectionButton() {
    return this.page.getByRole('button', { name: 'Download' })
  }

  get deleteSelectionButton() {
    return this.page.getByRole('button', { name: 'Delete' })
  }

  emptyStateTitle(title: string) {
    return this.page.getByText(title)
  }

  previewImage(filename: string) {
    return this.previewDialog.getByRole('img', { name: filename })
  }

  asset(name: string) {
    const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    return this.root.getByRole('button', {
      name: new RegExp(`^${escaped} - .* asset$`)
    })
  }

  contextMenuAction(name: string) {
    return this.page.getByRole('button', { name })
  }

  async showGenerated() {
    await this.generatedTab.click()
  }

  async showImported() {
    await this.importedTab.click()
  }

  async search(query: string) {
    await this.searchInput.fill(query)
  }

  async switchToListView() {
    await this.viewSettingsButton.click()
    await this.listViewButton.click()
  }

  async switchToGridView() {
    await this.viewSettingsButton.click()
    await this.gridViewButton.click()
  }

  async openContextMenuForAsset(name: string) {
    await this.asset(name).click({ button: 'right' })
  }

  async runContextMenuAction(assetName: string, actionName: string) {
    await this.openContextMenuForAsset(assetName)
    await this.contextMenuAction(actionName).click()
  }

  async openAssetPreview(name: string) {
    const asset = this.asset(name)
    await asset.hover()

    const zoomButton = asset.getByLabel('Zoom in')
    if (await zoomButton.isVisible().catch(() => false)) {
      await zoomButton.click()
      return
    }

    await asset.dblclick()
  }

  async openOutputFolder(name: string) {
    await this.asset(name)
      .getByRole('button', { name: 'See more outputs' })
      .click()

    await this.page
      .getByRole('button', { name: 'Back to all assets' })
      .waitFor({ state: 'visible' })
  }

  async toggleStack(name: string) {
    await this.asset(name)
      .getByRole('button', { name: 'See more outputs' })
      .click()
  }

  async selectAssets(names: string[]) {
    if (names.length === 0) {
      return
    }

    await this.asset(names[0]).click()

    const modifier = process.platform === 'darwin' ? 'Meta' : 'Control'
    for (const name of names.slice(1)) {
      await this.asset(name).click({
        modifiers: [modifier]
      })
    }
  }

  override async open() {
    await super.open()
    await this.root.waitFor({ state: 'visible' })
    await this.generatedTab.waitFor({ state: 'visible' })
  }
}
