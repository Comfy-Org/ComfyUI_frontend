import type { Locator, Page } from '@playwright/test'
import { expect } from '@playwright/test'

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

export class NodeLibrarySidebarTabV2 extends SidebarTab {
  constructor(public override readonly page: Page) {
    super(page, 'node-library')
  }

  get searchInput() {
    return this.page.getByPlaceholder('Search...')
  }

  get sidebarContent() {
    return this.page.locator('.sidebar-content-container')
  }

  getTab(name: string) {
    return this.sidebarContent.getByRole('tab', { name, exact: true })
  }

  get allTab() {
    return this.getTab('All')
  }

  get blueprintsTab() {
    return this.getTab('Blueprints')
  }

  get sortButton() {
    return this.sidebarContent.getByRole('button', { name: 'Sort' })
  }

  getFolder(folderName: string) {
    return this.sidebarContent
      .getByRole('treeitem', { name: folderName })
      .first()
  }

  getNode(nodeName: string) {
    return this.sidebarContent.getByRole('treeitem', { name: nodeName }).first()
  }

  async expandFolder(folderName: string) {
    const folder = this.getFolder(folderName)
    const isExpanded = await folder.getAttribute('aria-expanded')
    if (isExpanded !== 'true') {
      await folder.click()
    }
  }

  override async open() {
    await super.open()
    await this.searchInput.waitFor({ state: 'visible' })
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

  get root() {
    return this.page.locator('.sidebar-content-container')
  }

  // --- Tab navigation ---

  get generatedTab() {
    return this.page.getByRole('tab', { name: 'Generated' })
  }

  get importedTab() {
    return this.page.getByRole('tab', { name: 'Imported' })
  }

  // --- Empty state ---

  get emptyStateMessage() {
    return this.page.getByText(
      'Upload files or generate content to see them here'
    )
  }

  get searchInput() {
    return this.root.getByPlaceholder(/Search Assets/i)
  }

  get settingsButton() {
    return this.root.getByLabel('View settings')
  }

  get viewSettingsButton() {
    return this.settingsButton
  }

  get listViewOption() {
    return this.page.getByText('List view')
  }

  get listViewButton() {
    return this.listViewOption
  }

  get gridViewOption() {
    return this.page.getByText('Grid view')
  }

  get gridViewButton() {
    return this.gridViewOption
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

  emptyStateTitle(title: string) {
    return this.page.getByText(title)
  }

  previewImage(filename: string) {
    return this.previewDialog.getByRole('img', { name: filename })
  }

  asset(name: string) {
    return this.getAssetCardByName(name)
  }

  // --- Sort options (cloud-only, shown inside settings popover) ---

  get sortNewestFirst() {
    return this.page.getByText('Newest first')
  }

  get sortOldestFirst() {
    return this.page.getByText('Oldest first')
  }

  // --- Asset cards ---

  get assetCards() {
    return this.root.locator('[role="button"][data-selected]')
  }

  getAssetCardByName(name: string) {
    return this.assetCards.filter({ hasText: name }).first()
  }

  get selectedCards() {
    return this.root.locator('[data-selected="true"]')
  }

  // --- List view items ---

  get listViewItems() {
    return this.root.locator('[role="button"][tabindex="0"]')
  }

  // --- Selection footer ---

  get selectionFooter() {
    return this.root.locator('..').getByRole('toolbar', {
      name: 'Selected asset actions'
    })
  }

  get selectionCountButton() {
    return this.root
      .getByRole('button', { name: /Assets Selected:/ })
      .or(this.page.getByText(/Assets Selected: \d+/))
      .first()
  }

  get deselectAllButton() {
    return this.page.getByText('Deselect all')
  }

  get deleteSelectedButton() {
    return this.page
      .getByTestId('assets-delete-selected')
      .or(this.page.locator('button:has(.icon-\\[lucide--trash-2\\])').last())
      .first()
  }

  get deleteSelectionButton() {
    return this.deleteSelectedButton
  }

  get downloadSelectedButton() {
    return this.page
      .getByTestId('assets-download-selected')
      .or(this.page.locator('button:has(.icon-\\[lucide--download\\])').last())
      .first()
  }

  get downloadSelectionButton() {
    return this.downloadSelectedButton
  }

  // --- Context menu ---

  contextMenuItem(label: string) {
    return this.page.locator('.p-contextmenu').getByText(label)
  }

  contextMenuAction(label: string) {
    return this.contextMenuItem(label)
  }

  // --- Folder view ---

  get backToAssetsButton() {
    return this.backButton
  }

  // --- Loading ---

  get skeletonLoaders() {
    return this.root.locator('.animate-pulse')
  }

  async showGenerated() {
    await this.switchToGenerated()
  }

  async showImported() {
    await this.switchToImported()
  }

  async search(query: string) {
    await this.searchInput.fill(query)
  }

  async switchToListView() {
    await this.openSettingsMenu()
    await this.listViewOption.click()
  }

  async switchToGridView() {
    await this.openSettingsMenu()
    await this.gridViewOption.click()
  }

  async openContextMenuForAsset(name: string) {
    await this.asset(name).click({ button: 'right' })
    await this.page
      .locator('.p-contextmenu')
      .waitFor({ state: 'visible', timeout: 3000 })
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

    await this.backToAssetsButton.waitFor({ state: 'visible' })
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

    for (const name of names.slice(1)) {
      await this.asset(name).click({
        modifiers: ['ControlOrMeta']
      })
    }
  }

  override async open() {
    // Remove any toast notifications that may overlay the sidebar button
    await this.dismissToasts()
    await super.open()
    await this.root.waitFor({ state: 'visible' })
    await this.generatedTab.waitFor({ state: 'visible' })
  }

  /** Dismiss all visible toast notifications by clicking their close buttons. */
  async dismissToasts() {
    const closeButtons = this.page.locator('.p-toast-close-button')
    for (const btn of await closeButtons.all()) {
      await btn.click({ force: true }).catch(() => {})
    }
    // Wait for all toast elements to fully animate out and detach from DOM
    await expect(this.page.locator('.p-toast-message'))
      .toHaveCount(0, { timeout: 5000 })
      .catch(() => {})
  }

  async switchToImported() {
    await this.dismissToasts()
    await this.importedTab.click()
    await expect(this.importedTab).toHaveAttribute('aria-selected', 'true', {
      timeout: 3000
    })
  }

  async switchToGenerated() {
    await this.dismissToasts()
    await this.generatedTab.click()
    await expect(this.generatedTab).toHaveAttribute('aria-selected', 'true', {
      timeout: 3000
    })
  }

  async openSettingsMenu() {
    await this.dismissToasts()
    await this.settingsButton.click()
    // Wait for popover content to render
    await this.listViewOption
      .or(this.gridViewOption)
      .first()
      .waitFor({ state: 'visible', timeout: 3000 })
  }

  async rightClickAsset(name: string) {
    const card = this.getAssetCardByName(name)
    await card.click({ button: 'right' })
    await this.page
      .locator('.p-contextmenu')
      .waitFor({ state: 'visible', timeout: 3000 })
  }

  async waitForAssets(count?: number) {
    if (count !== undefined) {
      await expect(this.assetCards).toHaveCount(count, { timeout: 5000 })
    } else {
      await this.assetCards.first().waitFor({ state: 'visible', timeout: 5000 })
    }
  }
}
