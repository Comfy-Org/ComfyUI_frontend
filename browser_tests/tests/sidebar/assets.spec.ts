import { expect, mergeTests } from '@playwright/test'
import type { JobEntry } from '@comfyorg/ingest-types'

import { comfyPageFixture } from '@e2e/fixtures/ComfyPage'
import { assetScenarioFixture } from '@e2e/fixtures/assetScenarioFixture'
import {
  createMockJob,
  createMockJobs
} from '@e2e/fixtures/helpers/jobFixtures'

const test = mergeTests(comfyPageFixture, assetScenarioFixture)

const SAMPLE_JOBS: JobEntry[] = [
  createMockJob({
    id: 'job-alpha',
    create_time: 1_000_000,
    execution_start_time: 1_000_000,
    execution_end_time: 1_010_000,
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
    create_time: 2_000_000,
    execution_start_time: 2_000_000,
    execution_end_time: 2_003_000,
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
    create_time: 3_000_000,
    execution_start_time: 3_000_000,
    execution_end_time: 3_020_000,
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

test.describe('Assets sidebar - empty states', () => {
  test.beforeEach(async ({ comfyPage, assetScenario }) => {
    await assetScenario.seedEmptyState()
    await comfyPage.setup()
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

test.describe('Assets sidebar - tab navigation', () => {
  test.beforeEach(async ({ comfyPage, assetScenario }) => {
    await assetScenario.seedGeneratedHistory(SAMPLE_JOBS)
    await assetScenario.seedImportedFiles(SAMPLE_IMPORTED_FILES)
    await comfyPage.setup()
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

    await tab.switchToImported()
    await expect(tab.importedTab).toHaveAttribute('aria-selected', 'true')
    await expect(tab.generatedTab).toHaveAttribute('aria-selected', 'false')

    await tab.switchToGenerated()
    await expect(tab.generatedTab).toHaveAttribute('aria-selected', 'true')
  })

  test('Search is cleared when switching tabs', async ({ comfyPage }) => {
    const tab = comfyPage.menu.assetsTab
    await tab.open()

    await tab.searchInput.fill('landscape')
    await expect(tab.searchInput).toHaveValue('landscape')

    await tab.switchToImported()
    await expect(tab.searchInput).toHaveValue('')
  })
})

test.describe('Assets sidebar - grid view display', () => {
  test.beforeEach(async ({ comfyPage, assetScenario }) => {
    await assetScenario.seedGeneratedHistory(SAMPLE_JOBS)
    await assetScenario.seedImportedFiles(SAMPLE_IMPORTED_FILES)
    await comfyPage.setup()
  })

  test('Displays generated assets as cards in grid view', async ({
    comfyPage
  }) => {
    const tab = comfyPage.menu.assetsTab
    await tab.open()

    await tab.waitForAssets()
    const count = await tab.assetCards.count()
    expect(count).toBeGreaterThanOrEqual(1)
  })

  test('Displays imported files when switching to Imported tab', async ({
    comfyPage
  }) => {
    const tab = comfyPage.menu.assetsTab
    await tab.open()
    await tab.switchToImported()

    await expect(tab.assetCards.first()).toBeVisible({ timeout: 5000 })

    const count = await tab.assetCards.count()
    expect(count).toBeGreaterThanOrEqual(1)
  })
  test('Displays svg outputs', async ({ comfyPage, assetScenario }) => {
    await assetScenario.seedGeneratedHistory([
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

test.describe('Assets sidebar - view mode toggle', () => {
  test.beforeEach(async ({ comfyPage, assetScenario }) => {
    await assetScenario.seedGeneratedHistory(SAMPLE_JOBS)
    await assetScenario.seedImportedFiles([])
    await comfyPage.setup()
  })

  test('Can switch to list view via settings menu', async ({ comfyPage }) => {
    const tab = comfyPage.menu.assetsTab
    await tab.open()
    await tab.waitForAssets()

    await tab.openSettingsMenu()
    await tab.listViewOption.click()

    await expect(tab.listViewItems.first()).toBeVisible({ timeout: 5000 })
  })

  test('Can switch back to grid view', async ({ comfyPage }) => {
    const tab = comfyPage.menu.assetsTab
    await tab.open()
    await tab.waitForAssets()

    await tab.openSettingsMenu()
    await tab.listViewOption.click()
    await expect(tab.listViewItems.first()).toBeVisible({ timeout: 5000 })

    await tab.gridViewOption.click()
    await tab.waitForAssets()

    await expect(tab.assetCards.first()).toBeVisible({ timeout: 5000 })
  })
})

test.describe('Assets sidebar - search', () => {
  test.beforeEach(async ({ comfyPage, assetScenario }) => {
    await assetScenario.seedGeneratedHistory(SAMPLE_JOBS)
    await assetScenario.seedImportedFiles([])
    await comfyPage.setup()
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

    await tab.searchInput.fill('landscape')

    await expect(async () => {
      const filteredCount = await tab.assetCards.count()
      expect(filteredCount).toBeLessThan(initialCount)
    }).toPass({ timeout: 5000 })
  })

  test('Clearing search restores all assets', async ({ comfyPage }) => {
    const tab = comfyPage.menu.assetsTab
    await tab.open()
    await tab.waitForAssets()

    const initialCount = await tab.assetCards.count()

    await tab.searchInput.fill('landscape')
    await expect(async () => {
      expect(await tab.assetCards.count()).toBeLessThan(initialCount)
    }).toPass({ timeout: 5000 })

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

test.describe('Assets sidebar - selection', () => {
  test.beforeEach(async ({ comfyPage, assetScenario }) => {
    await assetScenario.seedGeneratedHistory(SAMPLE_JOBS)
    await assetScenario.seedImportedFiles([])
    await comfyPage.setup()
  })

  test('Clicking an asset card selects it', async ({ comfyPage }) => {
    const tab = comfyPage.menu.assetsTab
    await tab.open()
    await tab.waitForAssets()

    await tab.assetCards.first().click()

    await expect(tab.selectedCards).toHaveCount(1)
  })

  test('Ctrl+click adds to selection', async ({ comfyPage }) => {
    const tab = comfyPage.menu.assetsTab
    await tab.open()
    await tab.waitForAssets()

    const cards = tab.assetCards
    const cardCount = await cards.count()
    expect(cardCount).toBeGreaterThanOrEqual(2)

    await cards.first().click()
    await expect(tab.selectedCards).toHaveCount(1)

    await cards.nth(1).click({ modifiers: ['ControlOrMeta'] })
    await expect(tab.selectedCards).toHaveCount(2)
  })

  test('Selection shows footer with count and actions', async ({
    comfyPage
  }) => {
    const tab = comfyPage.menu.assetsTab
    await tab.open()
    await tab.waitForAssets()

    await tab.assetCards.first().click()

    await expect(tab.selectionCountButton).toBeVisible({ timeout: 3000 })
  })

  test('Deselect all clears selection', async ({ comfyPage }) => {
    const tab = comfyPage.menu.assetsTab
    await tab.open()
    await tab.waitForAssets()

    await tab.assetCards.first().click()
    await expect(tab.selectedCards).toHaveCount(1)

    await tab.selectionCountButton.hover()
    await expect(tab.deselectAllButton).toBeVisible({ timeout: 3000 })

    await tab.deselectAllButton.click()
    await expect(tab.selectedCards).toHaveCount(0)
  })

  test('Selection is cleared when switching tabs', async ({ comfyPage }) => {
    const tab = comfyPage.menu.assetsTab
    await tab.open()
    await tab.waitForAssets()

    await tab.assetCards.first().click()
    await expect(tab.selectedCards).toHaveCount(1)

    await tab.switchToImported()

    await tab.switchToGenerated()
    await tab.waitForAssets()
    await expect(tab.selectedCards).toHaveCount(0)
  })
})

test.describe('Assets sidebar - context menu', () => {
  test.beforeEach(async ({ comfyPage, assetScenario }) => {
    await assetScenario.seedGeneratedHistory(SAMPLE_JOBS)
    await assetScenario.seedImportedFiles([])
    await comfyPage.setup()
  })

  test('Right-clicking an asset shows context menu', async ({ comfyPage }) => {
    const tab = comfyPage.menu.assetsTab
    await tab.open()
    await tab.waitForAssets()

    await tab.assetCards.first().click({ button: 'right' })

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
    const cardCount = await cards.count()
    expect(cardCount).toBeGreaterThanOrEqual(2)

    await tab.dismissToasts()

    await cards.first().click()
    await comfyPage.page.keyboard.down('ControlOrMeta')
    await cards.nth(1).click()
    await comfyPage.page.keyboard.up('ControlOrMeta')

    await expect(tab.selectedCards).toHaveCount(2, { timeout: 3000 })
    await expect(tab.selectionFooter).toBeVisible({ timeout: 3000 })

    const contextMenu = comfyPage.page.locator('.p-contextmenu')
    await cards.first().dispatchEvent('contextmenu', {
      bubbles: true,
      cancelable: true,
      button: 2
    })
    await expect(contextMenu).toBeVisible()

    await expect(tab.contextMenuItem('Download all')).toBeVisible()
  })
})

test.describe('Assets sidebar - bulk actions', () => {
  test.beforeEach(async ({ comfyPage, assetScenario }) => {
    await assetScenario.seedGeneratedHistory(SAMPLE_JOBS)
    await assetScenario.seedImportedFiles([])
    await comfyPage.setup()
  })

  test('Footer shows download button when assets selected', async ({
    comfyPage
  }) => {
    const tab = comfyPage.menu.assetsTab
    await tab.open()
    await tab.waitForAssets()

    await tab.assetCards.first().click()

    await expect(tab.downloadSelectedButton).toBeVisible({ timeout: 3000 })
  })

  test('Footer shows delete button when output assets selected', async ({
    comfyPage
  }) => {
    const tab = comfyPage.menu.assetsTab
    await tab.open()
    await tab.waitForAssets()

    await tab.assetCards.first().click()

    await expect(tab.deleteSelectedButton).toBeVisible({ timeout: 3000 })
  })

  test('Selection count displays correct number', async ({ comfyPage }) => {
    const tab = comfyPage.menu.assetsTab
    await tab.open()
    await tab.waitForAssets()

    const cards = tab.assetCards
    const cardCount = await cards.count()
    expect(cardCount).toBeGreaterThanOrEqual(2)

    await cards.first().click()
    await cards.nth(1).click({ modifiers: ['ControlOrMeta'] })

    await expect(tab.selectionCountButton).toBeVisible({ timeout: 3000 })
    const text = await tab.selectionCountButton.textContent()
    expect(text).toMatch(/Assets Selected: \d+/)
  })
})

test.describe('Assets sidebar - delete confirmation', () => {
  test.beforeEach(async ({ comfyPage, assetScenario }) => {
    await assetScenario.seedGeneratedHistory(SAMPLE_JOBS)
    await assetScenario.seedImportedFiles([])
    await comfyPage.setup()
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

    await comfyPage.confirmDialog.click('delete')

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

    await comfyPage.confirmDialog.click('reject')

    await expect(tab.assetCards).toHaveCount(initialCount)
  })
})

test.describe('Assets sidebar - pagination', () => {
  test('initial load fetches first batch with offset 0', async ({
    comfyPage,
    assetScenario
  }) => {
    const manyJobs = createMockJobs(250)
    await assetScenario.seedGeneratedHistory(manyJobs)
    await comfyPage.setup()

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

test.describe('Assets sidebar - settings menu', () => {
  test.beforeEach(async ({ comfyPage, assetScenario }) => {
    await assetScenario.seedGeneratedHistory(SAMPLE_JOBS)
    await assetScenario.seedImportedFiles([])
    await comfyPage.setup()
  })

  test('Settings menu shows view mode options', async ({ comfyPage }) => {
    const tab = comfyPage.menu.assetsTab
    await tab.open()

    await tab.openSettingsMenu()

    await expect(tab.listViewOption).toBeVisible()
    await expect(tab.gridViewOption).toBeVisible()
  })
})
