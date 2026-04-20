import type { Locator, Page } from '@playwright/test'
import { expect } from '@playwright/test'

import type { WorkspaceStore } from '@e2e/types/globals'
import { TestIds } from '@e2e/fixtures/selectors'

class SidebarTab {
  public readonly tabButton: Locator
  public readonly selectedTabButton: Locator

  constructor(
    public readonly page: Page,
    public readonly tabId: string
  ) {
    this.tabButton = page.locator(`.${tabId}-tab-button`)
    this.selectedTabButton = page.locator(
      `.${tabId}-tab-button.side-bar-button-selected`
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
  public readonly nodeLibrarySearchBoxInput: Locator
  public readonly nodeLibraryTree: Locator
  public readonly nodePreview: Locator
  public readonly tabContainer: Locator
  public readonly newFolderButton: Locator

  constructor(public override readonly page: Page) {
    super(page, 'node-library')
    this.nodeLibrarySearchBoxInput = page.getByPlaceholder('Search Nodes...')
    this.nodeLibraryTree = page.getByTestId(TestIds.sidebar.nodeLibrary)
    this.nodePreview = page.locator('.node-lib-node-preview')
    this.tabContainer = page.locator('.sidebar-content-container')
    this.newFolderButton = this.tabContainer.locator('.new-folder-button')
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
  public readonly searchInput: Locator
  public readonly sidebarContent: Locator
  public readonly allTab: Locator
  public readonly blueprintsTab: Locator
  public readonly sortButton: Locator

  constructor(public override readonly page: Page) {
    super(page, 'node-library')
    this.searchInput = page.getByPlaceholder('Search...')
    this.sidebarContent = page.locator('.sidebar-content-container')
    this.allTab = this.getTab('All')
    this.blueprintsTab = this.getTab('Blueprints')
    this.sortButton = this.sidebarContent.getByRole('button', { name: 'Sort' })
  }

  getTab(name: string) {
    return this.sidebarContent.getByRole('tab', { name, exact: true })
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
  public readonly root: Locator
  public readonly activeWorkflowLabel: Locator
  public readonly searchInput: Locator

  constructor(public override readonly page: Page) {
    super(page, 'workflows')
    this.root = page.getByTestId(TestIds.sidebar.workflows)
    this.activeWorkflowLabel = this.root.locator(
      '.comfyui-workflows-open .p-tree-node-selected .node-label'
    )
    this.searchInput = this.root.getByRole('combobox').first()
  }

  async getOpenedWorkflowNames() {
    return await this.root
      .locator('.comfyui-workflows-open .node-label')
      .allInnerTexts()
  }

  async getActiveWorkflowName() {
    return await this.activeWorkflowLabel.innerText()
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
  public readonly searchInput: Locator
  public readonly modelTree: Locator
  public readonly refreshButton: Locator
  public readonly loadAllFoldersButton: Locator
  public readonly folderNodes: Locator
  public readonly leafNodes: Locator
  public readonly modelPreview: Locator

  constructor(public override readonly page: Page) {
    super(page, 'model-library')
    this.searchInput = page.getByPlaceholder('Search Models...')
    this.modelTree = page.locator('.model-lib-tree-explorer')
    this.refreshButton = page.getByRole('button', { name: 'Refresh' })
    this.loadAllFoldersButton = page.getByRole('button', {
      name: 'Load All Folders'
    })
    this.folderNodes = this.modelTree.locator(
      '.p-tree-node:not(.p-tree-node-leaf)'
    )
    this.leafNodes = this.modelTree.locator('.p-tree-node-leaf')
    this.modelPreview = page.locator('.model-lib-model-preview')
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
  // --- Tab navigation ---
  public readonly generatedTab: Locator
  public readonly importedTab: Locator

  // --- Empty state ---
  public readonly emptyStateMessage: Locator

  // --- Search & filter ---
  public readonly searchInput: Locator
  public readonly settingsButton: Locator

  // --- View mode ---
  public readonly listViewOption: Locator
  public readonly gridViewOption: Locator

  // --- Sort options (cloud-only, shown inside settings popover) ---
  public readonly sortNewestFirst: Locator
  public readonly sortOldestFirst: Locator

  // --- Asset cards ---
  public readonly assetCards: Locator
  public readonly selectedCards: Locator

  // --- List view items ---
  public readonly listViewItems: Locator

  // --- Selection footer ---
  public readonly selectionFooter: Locator
  public readonly selectionCountButton: Locator
  public readonly deselectAllButton: Locator
  public readonly deleteSelectedButton: Locator
  public readonly downloadSelectedButton: Locator

  // --- Folder view ---
  public readonly backToAssetsButton: Locator

  // --- Loading ---
  public readonly skeletonLoaders: Locator

  constructor(public override readonly page: Page) {
    super(page, 'assets')
    this.generatedTab = page.getByRole('tab', { name: 'Generated' })
    this.importedTab = page.getByRole('tab', { name: 'Imported' })
    this.emptyStateMessage = page.getByText(
      'Upload files or generate content to see them here'
    )
    this.searchInput = page.getByPlaceholder('Search Assets...')
    this.settingsButton = page.getByRole('button', { name: 'View settings' })
    this.listViewOption = page.getByText('List view')
    this.gridViewOption = page.getByText('Grid view')
    this.sortNewestFirst = page.getByText('Newest first')
    this.sortOldestFirst = page.getByText('Oldest first')
    this.assetCards = page
      .getByRole('button')
      .and(page.locator('[data-selected]'))
    this.selectedCards = page.locator('[data-selected="true"]')
    this.listViewItems = page.locator(
      '.sidebar-content-container [role="button"][tabindex="0"]'
    )
    this.selectionFooter = page
      .locator('.sidebar-content-container')
      .locator('..')
      .locator('[class*="h-18"]')
    this.selectionCountButton = page.getByText(/Assets Selected: \d+/)
    this.deselectAllButton = page.getByText('Deselect all')
    this.deleteSelectedButton = page
      .getByTestId('assets-delete-selected')
      .or(page.locator('button:has(.icon-\\[lucide--trash-2\\])').last())
      .first()
    this.downloadSelectedButton = page
      .getByTestId('assets-download-selected')
      .or(page.locator('button:has(.icon-\\[lucide--download\\])').last())
      .first()
    this.backToAssetsButton = page.getByText('Back to all assets')
    this.skeletonLoaders = page.locator(
      '.sidebar-content-container .animate-pulse'
    )
  }

  emptyStateTitle(title: string) {
    return this.page.getByText(title)
  }

  getAssetCardByName(name: string) {
    return this.assetCards.filter({ hasText: name })
  }

  contextMenuItem(label: string) {
    return this.page.locator('.p-contextmenu').getByText(label)
  }

  override async open() {
    // Remove any toast notifications that may overlay the sidebar button
    await this.dismissToasts()
    await super.open()
    await this.generatedTab.waitFor({ state: 'visible' })
  }

  /** Dismiss all visible toast notifications by clicking their close buttons. */
  async dismissToasts() {
    const closeButtons = this.page.locator('.p-toast-close-button')
    for (const btn of await closeButtons.all()) {
      await btn.click().catch(() => {})
    }
    // Wait for all toast elements to fully animate out and detach from DOM
    await expect(this.page.locator('.p-toast-message'))
      .toHaveCount(0)
      .catch(() => {})
  }

  async switchToImported() {
    await this.dismissToasts()
    await this.importedTab.click()
    await expect(this.importedTab).toHaveAttribute('aria-selected', 'true')
  }

  async switchToGenerated() {
    await this.dismissToasts()
    await this.generatedTab.click()
    await expect(this.generatedTab).toHaveAttribute('aria-selected', 'true')
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
      await expect(this.assetCards).toHaveCount(count)
    } else {
      await this.assetCards.first().waitFor({ state: 'visible', timeout: 5000 })
    }
  }
}
