import { expect } from '@playwright/test'

import { comfyPageFixture as test } from '@e2e/fixtures/ComfyPage'
import {
  createMockJob,
  createMockJobs
} from '@e2e/fixtures/helpers/AssetsHelper'
import type { RawJobListItem } from '@/platform/remote/comfyui/jobs/jobTypes'

// ---------------------------------------------------------------------------
// Shared fixtures
// ---------------------------------------------------------------------------

const SAMPLE_JOBS: RawJobListItem[] = [
  createMockJob({
    id: 'job-alpha',
    create_time: 1000,
    execution_start_time: 1000,
    execution_end_time: 1010,
    preview_output: {
      filename: 'landscape.png',
      subfolder: '',
      type: 'output',
      nodeId: '1',
      mediaType: 'images'
    },
    outputs_count: 1
  }),
  createMockJob({
    id: 'job-beta',
    create_time: 2000,
    execution_start_time: 2000,
    execution_end_time: 2003,
    preview_output: {
      filename: 'portrait.png',
      subfolder: '',
      type: 'output',
      nodeId: '2',
      mediaType: 'images'
    },
    outputs_count: 1
  }),
  createMockJob({
    id: 'job-gamma',
    create_time: 3000,
    execution_start_time: 3000,
    execution_end_time: 3020,
    preview_output: {
      filename: 'abstract_art.png',
      subfolder: '',
      type: 'output',
      nodeId: '3',
      mediaType: 'images'
    },
    outputs_count: 2
  })
]

const SAMPLE_IMPORTED_FILES = [
  'reference_photo.png',
  'background.jpg',
  'audio_clip.wav'
]

// ==========================================================================
// 1. Empty states
// ==========================================================================

test.describe('Assets sidebar - empty states', () => {
  test.beforeEach(async ({ comfyPage }) => {
    await comfyPage.assets.mockEmptyState()
    await comfyPage.setup()
  })

  test.afterEach(async ({ comfyPage }) => {
    await comfyPage.assets.clearMocks()
  })

  test('Shows empty-state copy for generated tab', async ({ comfyPage }) => {
    const tab = comfyPage.menu.assetsTab
    await tab.open()

    await expect(tab.emptyStateTitle('No generated files found')).toBeVisible()
    await expect(tab.emptyStateMessage).toBeVisible()
  })

  test('Shows empty-state copy for imported tab', async ({ comfyPage }) => {
    const tab = comfyPage.menu.assetsTab
    await tab.open()
    await tab.switchToImported()

    await expect(tab.emptyStateTitle('No imported files found')).toBeVisible()
    await expect(tab.emptyStateMessage).toBeVisible()
  })

  test('No asset cards are rendered when empty', async ({ comfyPage }) => {
    const tab = comfyPage.menu.assetsTab
    await tab.open()

    await expect(tab.assetCards).toHaveCount(0)
  })
})

// ==========================================================================
// 2. Tab navigation
// ==========================================================================

test.describe('Assets sidebar - tab navigation', () => {
  test.beforeEach(async ({ comfyPage }) => {
    await comfyPage.assets.mockOutputHistory(SAMPLE_JOBS)
    await comfyPage.assets.mockInputFiles(SAMPLE_IMPORTED_FILES)
    await comfyPage.setup()
  })

  test.afterEach(async ({ comfyPage }) => {
    await comfyPage.assets.clearMocks()
  })

  test('Generated tab is active by default', async ({ comfyPage }) => {
    const tab = comfyPage.menu.assetsTab
    await tab.open()

    await expect(tab.generatedTab).toHaveAttribute('aria-selected', 'true')
    await expect(tab.importedTab).toHaveAttribute('aria-selected', 'false')
  })

  test('Can switch between Generated and Imported tabs', async ({
    comfyPage
  }) => {
    const tab = comfyPage.menu.assetsTab
    await tab.open()

    // Switch to Imported
    await tab.switchToImported()
    await expect(tab.importedTab).toHaveAttribute('aria-selected', 'true')
    await expect(tab.generatedTab).toHaveAttribute('aria-selected', 'false')

    // Switch back to Generated
    await tab.switchToGenerated()
    await expect(tab.generatedTab).toHaveAttribute('aria-selected', 'true')
  })

  test('Search is cleared when switching tabs', async ({ comfyPage }) => {
    const tab = comfyPage.menu.assetsTab
    await tab.open()

    // Type search in Generated tab
    await tab.searchInput.fill('landscape')
    await expect(tab.searchInput).toHaveValue('landscape')

    // Switch to Imported tab
    await tab.switchToImported()
    await expect(tab.searchInput).toHaveValue('')
  })
})

// ==========================================================================
// 3. Asset display - grid view
// ==========================================================================

test.describe('Assets sidebar - grid view display', () => {
  test.beforeEach(async ({ comfyPage }) => {
    await comfyPage.assets.mockOutputHistory(SAMPLE_JOBS)
    await comfyPage.assets.mockInputFiles(SAMPLE_IMPORTED_FILES)
    await comfyPage.setup()
  })

  test.afterEach(async ({ comfyPage }) => {
    await comfyPage.assets.clearMocks()
  })

  test('Displays generated assets as cards in grid view', async ({
    comfyPage
  }) => {
    const tab = comfyPage.menu.assetsTab
    await tab.open()

    await tab.waitForAssets()
    await expect.poll(() => tab.assetCards.count()).toBeGreaterThanOrEqual(1)
  })

  test('Displays imported files when switching to Imported tab', async ({
    comfyPage
  }) => {
    const tab = comfyPage.menu.assetsTab
    await tab.open()
    await tab.switchToImported()

    // Wait for imported assets to render
    await expect(tab.assetCards.first()).toBeVisible({ timeout: 5000 })

    // Imported tab should show the mocked files
    await expect.poll(() => tab.assetCards.count()).toBeGreaterThanOrEqual(1)
  })
  test('Displays svg outputs', async ({ comfyPage }) => {
    await comfyPage.assets.mockOutputHistory([
      createMockJob({
        id: 'job-alpha',
        create_time: 1000,
        execution_start_time: 1000,
        execution_end_time: 1010,
        preview_output: {
          filename: 'logo.svg',
          subfolder: '',
          type: 'output',
          nodeId: '1',
          mediaType: 'images'
        },
        outputs_count: 1
      })
    ])

    const tab = comfyPage.menu.assetsTab
    await tab.open()

    await expect(tab.assetCards.locator('.pi-image')).toBeVisible()
  })
})

// ==========================================================================
// 4. View mode toggle (grid <-> list)
// ==========================================================================

test.describe('Assets sidebar - view mode toggle', () => {
  test.beforeEach(async ({ comfyPage }) => {
    await comfyPage.assets.mockOutputHistory(SAMPLE_JOBS)
    await comfyPage.assets.mockInputFiles([])
    await comfyPage.setup()
  })

  test.afterEach(async ({ comfyPage }) => {
    await comfyPage.assets.clearMocks()
  })

  test('Can switch to list view via settings menu', async ({ comfyPage }) => {
    const tab = comfyPage.menu.assetsTab
    await tab.open()
    await tab.waitForAssets()

    // Open settings menu and select list view
    await tab.openSettingsMenu()
    await tab.listViewOption.click()

    // List view items should now be visible
    await expect(tab.listViewItems.first()).toBeVisible({ timeout: 5000 })
  })

  test('Can switch back to grid view', async ({ comfyPage }) => {
    const tab = comfyPage.menu.assetsTab
    await tab.open()
    await tab.waitForAssets()

    // Switch to list view
    await tab.openSettingsMenu()
    await tab.listViewOption.click()
    await expect(tab.listViewItems.first()).toBeVisible({ timeout: 5000 })

    // Switch back to grid view (settings popover is still open)
    await tab.gridViewOption.click()
    await tab.waitForAssets()

    // Grid cards (with data-selected attribute) should be visible again
    await expect(tab.assetCards.first()).toBeVisible({ timeout: 5000 })
  })
})

// ==========================================================================
// 5. Search functionality
// ==========================================================================

test.describe('Assets sidebar - search', () => {
  test.beforeEach(async ({ comfyPage }) => {
    await comfyPage.assets.mockOutputHistory(SAMPLE_JOBS)
    await comfyPage.assets.mockInputFiles([])
    await comfyPage.setup()
  })

  test.afterEach(async ({ comfyPage }) => {
    await comfyPage.assets.clearMocks()
  })

  test('Search input is visible', async ({ comfyPage }) => {
    const tab = comfyPage.menu.assetsTab
    await tab.open()

    await expect(tab.searchInput).toBeVisible()
  })

  test('Filtering assets by search query reduces displayed count', async ({
    comfyPage
  }) => {
    const tab = comfyPage.menu.assetsTab
    await tab.open()
    await tab.waitForAssets()

    const initialCount = await tab.assetCards.count()

    // Search for a specific filename that matches only one asset
    await tab.searchInput.fill('landscape')

    // Wait for filter to reduce the count
    await expect
      .poll(() => tab.assetCards.count(), { timeout: 5000 })
      .toBeLessThan(initialCount)
  })

  test('Clearing search restores all assets', async ({ comfyPage }) => {
    const tab = comfyPage.menu.assetsTab
    await tab.open()
    await tab.waitForAssets()

    const initialCount = await tab.assetCards.count()

    // Filter then clear
    await tab.searchInput.fill('landscape')
    await expect.poll(() => tab.assetCards.count()).toBeLessThan(initialCount)

    await tab.searchInput.fill('')
    await expect(tab.assetCards).toHaveCount(initialCount, { timeout: 5000 })
  })

  test('Search with no matches shows empty state', async ({ comfyPage }) => {
    const tab = comfyPage.menu.assetsTab
    await tab.open()
    await tab.waitForAssets()

    await tab.searchInput.fill('nonexistent_file_xyz')
    await expect(tab.assetCards).toHaveCount(0, { timeout: 5000 })
  })
})

// ==========================================================================
// 6. Asset selection
// ==========================================================================

test.describe('Assets sidebar - selection', () => {
  test.beforeEach(async ({ comfyPage }) => {
    await comfyPage.assets.mockOutputHistory(SAMPLE_JOBS)
    await comfyPage.assets.mockInputFiles([])
    await comfyPage.setup()
  })

  test.afterEach(async ({ comfyPage }) => {
    await comfyPage.assets.clearMocks()
  })

  test('Clicking an asset card selects it', async ({ comfyPage }) => {
    const tab = comfyPage.menu.assetsTab
    await tab.open()
    await tab.waitForAssets()

    // Click first asset card
    await tab.assetCards.first().click()

    // Should have data-selected="true"
    await expect(tab.selectedCards).toHaveCount(1)
  })

  test('Ctrl+click adds to selection', async ({ comfyPage }) => {
    const tab = comfyPage.menu.assetsTab
    await tab.open()
    await tab.waitForAssets()

    const cards = tab.assetCards
    await expect.poll(() => cards.count()).toBeGreaterThanOrEqual(2)

    // Click first card
    await cards.first().click()
    await expect(tab.selectedCards).toHaveCount(1)

    // Ctrl+click second card
    await cards.nth(1).click({ modifiers: ['ControlOrMeta'] })
    await expect(tab.selectedCards).toHaveCount(2)
  })

  test('Selection shows footer with count and actions', async ({
    comfyPage
  }) => {
    const tab = comfyPage.menu.assetsTab
    await tab.open()
    await tab.waitForAssets()

    // Select an asset
    await tab.assetCards.first().click()

    // Footer should show selection count
    await expect(tab.selectionCountButton).toBeVisible({ timeout: 3000 })
  })

  test('Deselect all clears selection', async ({ comfyPage }) => {
    const tab = comfyPage.menu.assetsTab
    await tab.open()
    await tab.waitForAssets()

    // Select an asset
    await tab.assetCards.first().click()
    await expect(tab.selectedCards).toHaveCount(1)

    // Hover over the selection count button to reveal "Deselect all"
    await tab.selectionCountButton.hover()
    await expect(tab.deselectAllButton).toBeVisible({ timeout: 3000 })

    // Click "Deselect all"
    await tab.deselectAllButton.click()
    await expect(tab.selectedCards).toHaveCount(0)
  })

  test('Selection is cleared when switching tabs', async ({ comfyPage }) => {
    const tab = comfyPage.menu.assetsTab
    await tab.open()
    await tab.waitForAssets()

    // Select an asset
    await tab.assetCards.first().click()
    await expect(tab.selectedCards).toHaveCount(1)

    // Switch to Imported tab
    await tab.switchToImported()

    // Switch back - selection should be cleared
    await tab.switchToGenerated()
    await tab.waitForAssets()
    await expect(tab.selectedCards).toHaveCount(0)
  })
})

// ==========================================================================
// 7. Context menu
// ==========================================================================

test.describe('Assets sidebar - context menu', () => {
  test.beforeEach(async ({ comfyPage }) => {
    await comfyPage.assets.mockOutputHistory(SAMPLE_JOBS)
    await comfyPage.assets.mockInputFiles([])
    await comfyPage.setup()
  })

  test.afterEach(async ({ comfyPage }) => {
    await comfyPage.assets.clearMocks()
  })

  test('Right-clicking an asset shows context menu', async ({ comfyPage }) => {
    const tab = comfyPage.menu.assetsTab
    await tab.open()
    await tab.waitForAssets()

    // Right-click first asset
    await tab.assetCards.first().click({ button: 'right' })

    // Context menu should appear with standard items
    const contextMenu = comfyPage.page.locator('.p-contextmenu')
    await expect(contextMenu).toBeVisible({ timeout: 3000 })
  })

  test('Context menu contains Download action for output asset', async ({
    comfyPage
  }) => {
    const tab = comfyPage.menu.assetsTab
    await tab.open()
    await tab.waitForAssets()

    await tab.assetCards.first().click({ button: 'right' })
    await comfyPage.page
      .locator('.p-contextmenu')
      .waitFor({ state: 'visible', timeout: 3000 })

    await expect(tab.contextMenuItem('Download')).toBeVisible()
  })

  test('Context menu contains Inspect action for image assets', async ({
    comfyPage
  }) => {
    const tab = comfyPage.menu.assetsTab
    await tab.open()
    await tab.waitForAssets()

    await tab.assetCards.first().click({ button: 'right' })
    await comfyPage.page
      .locator('.p-contextmenu')
      .waitFor({ state: 'visible', timeout: 3000 })

    await expect(tab.contextMenuItem('Inspect asset')).toBeVisible()
  })

  test('Context menu contains Delete action for output assets', async ({
    comfyPage
  }) => {
    const tab = comfyPage.menu.assetsTab
    await tab.open()
    await tab.waitForAssets()

    await tab.assetCards.first().click({ button: 'right' })
    await comfyPage.page
      .locator('.p-contextmenu')
      .waitFor({ state: 'visible', timeout: 3000 })

    await expect(tab.contextMenuItem('Delete')).toBeVisible()
  })

  test('Context menu contains Copy job ID for output assets', async ({
    comfyPage
  }) => {
    const tab = comfyPage.menu.assetsTab
    await tab.open()
    await tab.waitForAssets()

    await tab.assetCards.first().click({ button: 'right' })
    await comfyPage.page
      .locator('.p-contextmenu')
      .waitFor({ state: 'visible', timeout: 3000 })

    await expect(tab.contextMenuItem('Copy job ID')).toBeVisible()
  })

  test('Context menu contains workflow actions for output assets', async ({
    comfyPage
  }) => {
    const tab = comfyPage.menu.assetsTab
    await tab.open()
    await tab.waitForAssets()

    await tab.assetCards.first().click({ button: 'right' })

    const contextMenu = comfyPage.page.locator('.p-contextmenu')
    await expect(contextMenu).toBeVisible({ timeout: 3000 })

    await expect(
      tab.contextMenuItem('Open as workflow in new tab')
    ).toBeVisible()
    await expect(tab.contextMenuItem('Export workflow')).toBeVisible()
  })

  test('Bulk context menu shows when multiple assets selected', async ({
    comfyPage
  }) => {
    const tab = comfyPage.menu.assetsTab
    await tab.open()
    await tab.waitForAssets()

    const cards = tab.assetCards
    await expect.poll(() => cards.count()).toBeGreaterThanOrEqual(2)

    // Dismiss any toasts that appeared after asset loading
    await tab.dismissToasts()

    // Multi-select: use keyboard.down/up so useKeyModifier('Control') detects
    // the modifier — click({ modifiers }) only sets the mouse event flag and
    // does not fire a keydown event that VueUse tracks.
    await cards.first().click()
    await comfyPage.page.keyboard.down('Control')
    await cards.nth(1).click()
    await comfyPage.page.keyboard.up('Control')

    // Verify multi-selection took effect and footer is stable before right-clicking
    await expect(tab.selectedCards).toHaveCount(2, { timeout: 3000 })
    await expect(tab.selectionFooter).toBeVisible({ timeout: 3000 })

    // Use dispatchEvent instead of click({ button: 'right' }) to avoid any
    // overlay intercepting the event, and assert directly without toPass.
    const contextMenu = comfyPage.page.locator('.p-contextmenu')
    await cards.first().dispatchEvent('contextmenu', {
      bubbles: true,
      cancelable: true,
      button: 2
    })
    await expect(contextMenu).toBeVisible()

    // Bulk menu should show bulk download action
    await expect(tab.contextMenuItem('Download all')).toBeVisible()
  })
})

// ==========================================================================
// 8. Bulk actions (footer)
// ==========================================================================

test.describe('Assets sidebar - bulk actions', () => {
  test.beforeEach(async ({ comfyPage }) => {
    await comfyPage.assets.mockOutputHistory(SAMPLE_JOBS)
    await comfyPage.assets.mockInputFiles([])
    await comfyPage.setup()
  })

  test.afterEach(async ({ comfyPage }) => {
    await comfyPage.assets.clearMocks()
  })

  test('Footer shows download button when assets selected', async ({
    comfyPage
  }) => {
    const tab = comfyPage.menu.assetsTab
    await tab.open()
    await tab.waitForAssets()

    await tab.assetCards.first().click()

    // Download button in footer should be visible
    await expect(tab.downloadSelectedButton).toBeVisible({ timeout: 3000 })
  })

  test('Footer shows delete button when output assets selected', async ({
    comfyPage
  }) => {
    const tab = comfyPage.menu.assetsTab
    await tab.open()
    await tab.waitForAssets()

    await tab.assetCards.first().click()

    // Delete button in footer should be visible
    await expect(tab.deleteSelectedButton).toBeVisible({ timeout: 3000 })
  })

  test('Selection count displays correct number', async ({ comfyPage }) => {
    const tab = comfyPage.menu.assetsTab
    await tab.open()
    await tab.waitForAssets()

    // Select the two single-output assets (job-alpha, job-beta).
    // The count reflects total outputs, not cards — job-gamma has
    // outputs_count: 2 which would inflate the total.
    const cards = tab.assetCards
    await expect.poll(() => cards.count()).toBeGreaterThanOrEqual(3)

    // Cards are sorted newest-first: gamma (idx 0), beta (1), alpha (2)
    await cards.nth(1).click()
    await comfyPage.page.keyboard.down('Control')
    await cards.nth(2).click()
    await comfyPage.page.keyboard.up('Control')

    // Selection count should show the count
    await expect(tab.selectionCountButton).toBeVisible({ timeout: 3000 })
    await expect(tab.selectionCountButton).toHaveText(/Assets Selected:\s*2\b/)
  })
})

// ==========================================================================
// 9. Pagination
// ==========================================================================

test.describe('Assets sidebar - pagination', () => {
  test.afterEach(async ({ comfyPage }) => {
    await comfyPage.assets.clearMocks()
  })

  test('initial load fetches first batch with offset 0', async ({
    comfyPage
  }) => {
    const manyJobs = createMockJobs(250)
    await comfyPage.assets.mockOutputHistory(manyJobs)
    await comfyPage.setup()

    // Capture the first history fetch (terminal statuses only).
    // Queue polling also hits /jobs but with status=in_progress,pending.
    const firstRequest = comfyPage.page.waitForRequest((req) => {
      if (!/\/api\/jobs\?/.test(req.url())) return false
      const url = new URL(req.url())
      const status = url.searchParams.get('status') ?? ''
      return status.includes('completed')
    })

    const tab = comfyPage.menu.assetsTab
    await tab.open()
    await tab.waitForAssets()

    const req = await firstRequest
    const url = new URL(req.url())
    expect(url.searchParams.get('offset')).toBe('0')
    expect(Number(url.searchParams.get('limit'))).toBeGreaterThan(0)
  })
})

// ==========================================================================
// 10. Settings menu visibility
// ==========================================================================

test.describe('Assets sidebar - settings menu', () => {
  test.beforeEach(async ({ comfyPage }) => {
    await comfyPage.assets.mockOutputHistory(SAMPLE_JOBS)
    await comfyPage.assets.mockInputFiles([])
    await comfyPage.setup()
  })

  test.afterEach(async ({ comfyPage }) => {
    await comfyPage.assets.clearMocks()
  })

  test('Settings menu shows view mode options', async ({ comfyPage }) => {
    const tab = comfyPage.menu.assetsTab
    await tab.open()

    await tab.openSettingsMenu()

    await expect(tab.listViewOption).toBeVisible()
    await expect(tab.gridViewOption).toBeVisible()
  })
})

// ==========================================================================
// 11. Delete confirmation
// ==========================================================================

test.describe('Assets sidebar - delete confirmation', () => {
  test.beforeEach(async ({ comfyPage }) => {
    await comfyPage.assets.mockOutputHistory(SAMPLE_JOBS)
    await comfyPage.assets.mockDeleteHistory()
    await comfyPage.assets.mockInputFiles([])
    await comfyPage.setup()
  })

  test.afterEach(async ({ comfyPage }) => {
    await comfyPage.assets.clearMocks()
  })

  test('Right-click delete shows confirmation dialog', async ({
    comfyPage
  }) => {
    const tab = comfyPage.menu.assetsTab
    await tab.open()
    await tab.waitForAssets()

    await tab.assetCards.first().click({ button: 'right' })
    await tab.contextMenuItem('Delete').click()

    const dialog = comfyPage.confirmDialog.root
    await expect(dialog).toBeVisible()
    await expect(dialog.getByText('Delete this asset?')).toBeVisible()
    await expect(
      dialog.getByText('This asset will be permanently removed.')
    ).toBeVisible()
  })

  test('Confirming delete removes asset and shows success toast', async ({
    comfyPage
  }) => {
    const tab = comfyPage.menu.assetsTab
    await tab.open()
    await tab.waitForAssets()

    const initialCount = await tab.assetCards.count()

    await tab.assetCards.first().click({ button: 'right' })
    await tab.contextMenuItem('Delete').click()

    const dialog = comfyPage.confirmDialog.root
    await expect(dialog).toBeVisible()

    await comfyPage.confirmDialog.delete.click()

    await expect(dialog).not.toBeVisible()
    await expect(tab.assetCards).toHaveCount(initialCount - 1, {
      timeout: 5000
    })

    const successToast = comfyPage.page.locator('.p-toast-message-success')
    await expect(successToast).toBeVisible({ timeout: 5000 })
  })

  test('Cancelling delete preserves asset', async ({ comfyPage }) => {
    const tab = comfyPage.menu.assetsTab
    await tab.open()
    await tab.waitForAssets()

    const initialCount = await tab.assetCards.count()

    await tab.assetCards.first().click({ button: 'right' })
    await tab.contextMenuItem('Delete').click()

    const dialog = comfyPage.confirmDialog.root
    await expect(dialog).toBeVisible()

    await comfyPage.confirmDialog.reject.click()

    await expect(dialog).not.toBeVisible()
    await expect(tab.assetCards).toHaveCount(initialCount)
  })
})
