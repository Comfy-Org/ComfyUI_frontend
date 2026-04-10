import type { Locator, Page } from '@playwright/test'
import { expect } from '@playwright/test'

import type { WorkspaceStore } from '@e2e/types/globals'
import { TestIds } from '@e2e/fixtures/selectors'

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

  async dismissToasts() {
    const closeButtons = this.page.locator('.p-toast-close-button')
    for (const button of await closeButtons.all()) {
      await button.click({ force: true }).catch(() => {})
    }

    await expect(this.page.locator('.p-toast-message'))
      .toHaveCount(0, { timeout: 5000 })
      .catch(() => {})
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

  get activeWorkflowLabel(): Locator {
    return this.root.locator(
      '.comfyui-workflows-open .p-tree-node-selected .node-label'
    )
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

export class JobHistorySidebarTab extends SidebarTab {
  constructor(public override readonly page: Page) {
    super(page, 'job-history')
  }

  /** Scope all locators to the sidebar root to avoid collision
   *  with QueueOverlayExpanded which renders the same controls. */
  get root() {
    return this.page.locator('.sidebar-content-container')
  }

  get allTab() {
    return this.root.getByRole('button', { name: 'All', exact: true })
  }

  get completedTab() {
    return this.root.getByRole('button', { name: 'Completed', exact: true })
  }

  get failedTab() {
    return this.root.getByRole('button', { name: 'Failed', exact: true })
  }

  get searchInput() {
    return this.root.getByPlaceholder('Search...')
  }

  get filterButton() {
    return this.root.getByRole('button', { name: /Filter/i })
  }

  get sortButton() {
    return this.root.getByRole('button', { name: /Sort/i })
  }

  get jobItems() {
    return this.root.locator('[data-job-id]')
  }

  get noActiveJobsText() {
    return this.root.getByText('No active jobs')
  }

  async waitForJobsLoad() {
    await expect(this.jobItems.first()).toBeVisible({ timeout: 5000 })
  }

  getJobById(id: string) {
    return this.root.locator(`[data-job-id="${id}"]`)
  }

  get groupLabels() {
    return this.root.locator('.text-xs.text-text-secondary')
  }

  override async open() {
    await this.dismissToasts()
    await super.open()
    await this.allTab.waitFor({ state: 'visible', timeout: 5000 })
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

  emptyStateTitle(title: string) {
    return this.page.getByText(title)
  }

  // --- Search & filter ---

  get searchInput() {
    return this.page.getByPlaceholder('Search Assets...')
  }

  get settingsButton() {
    return this.page.getByRole('button', { name: 'View settings' })
  }

  // --- View mode ---

  get listViewOption() {
    return this.page.getByText('List view')
  }

  get gridViewOption() {
    return this.page.getByText('Grid view')
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
    return this.page.locator('[role="button"][data-selected]')
  }

  getAssetCardByName(name: string) {
    return this.page.locator('[role="button"][data-selected]', {
      hasText: name
    })
  }

  get selectedCards() {
    return this.page.locator('[data-selected="true"]')
  }

  // --- List view items ---

  get listViewItems() {
    return this.page.locator(
      '.sidebar-content-container [role="button"][tabindex="0"]'
    )
  }

  // --- Selection footer ---

  get selectionFooter() {
    return this.page
      .locator('.sidebar-content-container')
      .locator('..')
      .locator('[class*="h-18"]')
  }

  get selectionCountButton() {
    return this.page.getByText(/Assets Selected: \d+/)
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

  get downloadSelectedButton() {
    return this.page
      .getByTestId('assets-download-selected')
      .or(this.page.locator('button:has(.icon-\\[lucide--download\\])').last())
      .first()
  }

  // --- Context menu ---

  contextMenuItem(label: string) {
    return this.page.locator('.p-contextmenu').getByText(label)
  }

  // --- Folder view ---

  get backToAssetsButton() {
    return this.page.getByText('Back to all assets')
  }

  // --- Loading ---

  get skeletonLoaders() {
    return this.page.locator('.sidebar-content-container .animate-pulse')
  }

  // --- Helpers ---

  override async open() {
    // Remove any toast notifications that may overlay the sidebar button
    await this.dismissToasts()
    await super.open()
    await this.generatedTab.waitFor({ state: 'visible' })
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
