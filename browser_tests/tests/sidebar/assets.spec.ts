import { expect } from '@playwright/test'

import { comfyPageFixture as test } from '@e2e/fixtures/ComfyPage'
import {
  createMockJob,
  createMockJobs
} from '@e2e/fixtures/helpers/AssetsHelper'
import type {
  JobDetail,
  RawJobListItem
} from '@/platform/remote/comfyui/jobs/jobTypes'

// Legacy coverage backed by AssetsHelper's shadow backend. New assets-sidebar
// browser coverage should use typed route mocks in assetsSidebarTab.spec.ts.

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

const JOB_GAMMA_DETAIL: JobDetail = {
  ...SAMPLE_JOBS[2],
  outputs: {
    '3': {
      images: [
        {
          filename: 'abstract_art.png',
          subfolder: '',
          type: 'output'
        },
        {
          filename: 'abstract_art_alt.png',
          subfolder: '',
          type: 'output'
        }
      ]
    }
  },
  workflow: {
    extra_data: {
      extra_pnginfo: {
        workflow: {
          version: 0.4,
          last_node_id: 0,
          last_link_id: 0,
          nodes: [],
          links: []
        }
      }
    }
  }
}

const cloudTest = test.extend<{ mockCloudAssetSidebarData: void }>({
  mockCloudAssetSidebarData: async ({ comfyPage }, use) => {
    await comfyPage.assets.mockOutputHistory(SAMPLE_JOBS)
    await comfyPage.assets.mockEmptyCloudAssets()

    await use()

    await comfyPage.assets.clearMocks()
  }
})

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
    await tab.open({ waitForAssets: false })

    await expect(tab.emptyStateTitle('No generated files found')).toBeVisible()
    await expect(tab.emptyStateMessage).toBeVisible()
  })

  test('Shows empty-state copy for imported tab', async ({ comfyPage }) => {
    const tab = comfyPage.menu.assetsTab
    await tab.open({ waitForAssets: false })
    await tab.switchToImported()

    await expect(tab.emptyStateTitle('No imported files found')).toBeVisible()
    await expect(tab.emptyStateMessage).toBeVisible()
  })

  test('No asset cards are rendered when empty', async ({ comfyPage }) => {
    const tab = comfyPage.menu.assetsTab
    await tab.open({ waitForAssets: false })

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

    await expect.poll(() => tab.assetCards.count()).toBeGreaterThanOrEqual(1)
  })

  test('Displays imported files when switching to Imported tab', async ({
    comfyPage
  }) => {
    const tab = comfyPage.menu.assetsTab
    await tab.open()
    await tab.switchToImported()

    await expect(tab.assetCards.first()).toBeVisible()

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

    await tab.openSettingsMenu()
    await tab.listViewOption.click()

    await expect(tab.listViewItems.first()).toBeVisible()
  })

  test('Can switch back to grid view', async ({ comfyPage }) => {
    const tab = comfyPage.menu.assetsTab
    await tab.open()

    await tab.openSettingsMenu()
    await tab.listViewOption.click()
    await expect(tab.listViewItems.first()).toBeVisible()

    await tab.gridViewOption.click()
    await tab.waitForAssets()

    await expect(tab.assetCards.first()).toBeVisible()
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

    const initialCount = await tab.assetCards.count()

    await tab.searchInput.fill('landscape')

    await expect.poll(() => tab.assetCards.count()).toBeLessThan(initialCount)
  })

  test('Clearing search restores all assets', async ({ comfyPage }) => {
    const tab = comfyPage.menu.assetsTab
    await tab.open()

    const initialCount = await tab.assetCards.count()

    await tab.searchInput.fill('landscape')
    await expect.poll(() => tab.assetCards.count()).toBeLessThan(initialCount)

    await tab.searchInput.fill('')
    await expect(tab.assetCards).toHaveCount(initialCount)
  })

  test('Search with no matches shows empty state', async ({ comfyPage }) => {
    const tab = comfyPage.menu.assetsTab
    await tab.open()

    await tab.searchInput.fill('nonexistent_file_xyz')
    await expect(tab.assetCards).toHaveCount(0)
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

    await tab.assetCards.first().click()

    await expect(tab.selectedCards).toHaveCount(1)
  })

  test('Ctrl+click adds to selection', async ({ comfyPage }) => {
    const tab = comfyPage.menu.assetsTab
    await tab.open()

    const cards = tab.assetCards
    await expect.poll(() => cards.count()).toBeGreaterThanOrEqual(2)

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

    await tab.assetCards.first().click()

    await expect(tab.selectionCountButton).toBeVisible()
  })

  test('Deselect all clears selection', async ({ comfyPage }) => {
    const tab = comfyPage.menu.assetsTab
    await tab.open()

    await tab.assetCards.first().click()
    await expect(tab.selectedCards).toHaveCount(1)

    await expect(tab.deselectAllButton).toBeVisible()
    await tab.deselectAllButton.click()
    await expect(tab.selectedCards).toHaveCount(0)
  })

  test('Selection is cleared when switching tabs', async ({ comfyPage }) => {
    const tab = comfyPage.menu.assetsTab
    await tab.open()

    await tab.assetCards.first().click()
    await expect(tab.selectedCards).toHaveCount(1)

    await tab.switchToImported()

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

    await tab.assetCards.first().click({ button: 'right' })

    const contextMenu = comfyPage.page.locator('.p-contextmenu')
    await expect(contextMenu).toBeVisible()
  })

  test('Context menu contains Download action for output asset', async ({
    comfyPage
  }) => {
    const tab = comfyPage.menu.assetsTab
    await tab.open()

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

    await tab.assetCards.first().click({ button: 'right' })

    const contextMenu = comfyPage.page.locator('.p-contextmenu')
    await expect(contextMenu).toBeVisible()

    await expect(
      tab.contextMenuItem('Open as workflow in new tab')
    ).toBeVisible()
    await expect(tab.contextMenuItem('Export workflow')).toBeVisible()
  })

  test('Cancelling export-workflow filename prompt does not show an error toast', async ({
    comfyPage
  }) => {
    await comfyPage.assets.mockJobDetail('job-gamma', JOB_GAMMA_DETAIL)

    const tab = comfyPage.menu.assetsTab
    await tab.open()

    await tab.assetCards.first().click({ button: 'right' })
    await tab.contextMenuItem('Export workflow').click()

    const promptDialog = comfyPage.page.getByRole('dialog', {
      name: 'Export Workflow'
    })
    await expect(promptDialog).toBeVisible()

    await comfyPage.page.keyboard.press('Escape')
    await expect(promptDialog).toBeHidden()

    await expect(comfyPage.toast.toastErrors).toBeHidden({ timeout: 1500 })
  })

  test('Confirming export-workflow prompt downloads the file and shows a success toast', async ({
    comfyPage
  }) => {
    await comfyPage.assets.mockJobDetail('job-gamma', JOB_GAMMA_DETAIL)

    const tab = comfyPage.menu.assetsTab
    await tab.open()

    await tab.assetCards.first().click({ button: 'right' })
    await tab.contextMenuItem('Export workflow').click()

    const promptDialog = comfyPage.page.getByRole('dialog', {
      name: 'Export Workflow'
    })
    await expect(promptDialog).toBeVisible()

    const downloadPromise = comfyPage.page.waitForEvent('download')
    await promptDialog.getByRole('button', { name: 'Confirm' }).click()

    const download = await downloadPromise
    expect(download.suggestedFilename()).toBe('abstract_art.json')

    await expect(comfyPage.toast.toastSuccesses).toBeVisible()
  })

  test('Export-workflow shows a warning toast when the asset has no workflow', async ({
    comfyPage
  }) => {
    const { workflow: _, ...detailWithoutWorkflow } = JOB_GAMMA_DETAIL
    await comfyPage.assets.mockJobDetail('job-gamma', detailWithoutWorkflow)

    const tab = comfyPage.menu.assetsTab
    await tab.open()

    await tab.assetCards.first().click({ button: 'right' })
    await tab.contextMenuItem('Export workflow').click()

    await expect(comfyPage.toast.toastWarnings).toBeVisible()
    await expect(comfyPage.toast.toastSuccesses).toBeHidden({ timeout: 1500 })
  })

  test('Bulk context menu shows when multiple assets selected', async ({
    comfyPage
  }) => {
    const tab = comfyPage.menu.assetsTab
    await tab.open()

    const cards = tab.assetCards
    await expect.poll(() => cards.count()).toBeGreaterThanOrEqual(2)

    await tab.dismissToasts()

    // useKeyModifier('Control') needs keyboard events, not click modifiers.
    await cards.first().click()
    await comfyPage.page.keyboard.down('Control')
    await cards.nth(1).click()
    await comfyPage.page.keyboard.up('Control')

    await expect(tab.selectedCards).toHaveCount(2)
    await expect(tab.selectionFooter).toBeVisible()

    // dispatchEvent avoids the selection footer intercepting a right click.
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

    await tab.assetCards.first().click()

    await expect(tab.downloadSelectedButton).toBeVisible()
  })

  test('Footer shows delete button when output assets selected', async ({
    comfyPage
  }) => {
    const tab = comfyPage.menu.assetsTab
    await tab.open()

    await tab.assetCards.first().click()

    await expect(tab.deleteSelectedButton).toBeVisible()
  })

  test('Selection count displays correct number', async ({ comfyPage }) => {
    const tab = comfyPage.menu.assetsTab
    await tab.open()

    const cards = tab.assetCards
    await expect.poll(() => cards.count()).toBeGreaterThanOrEqual(3)

    await cards.nth(1).click()
    await comfyPage.page.keyboard.down('Control')
    await cards.nth(2).click()
    await comfyPage.page.keyboard.up('Control')

    await expect(tab.selectionCountButton).toBeVisible()
    await expect(tab.selectionCountButton).toHaveText(/\b2 selected\b/)
  })

  test('Selection count sums the outputs of a stacked asset', async ({
    comfyPage
  }) => {
    const tab = comfyPage.menu.assetsTab
    await tab.open()

    await tab.assetCards.first().click()

    await expect(tab.selectionCountButton).toBeVisible()
    await expect(tab.selectionCountButton).toHaveText(/\b2 selected\b/)
  })

  test('Selection bar stays capped, not stretched, on a wide panel', async ({
    comfyPage
  }) => {
    await comfyPage.page.setViewportSize({ width: 1600, height: 900 })
    const tab = comfyPage.menu.assetsTab
    await tab.open()

    const gutter = comfyPage.page.locator('.p-splitter-gutter').first()
    await expect(gutter).toBeVisible()
    const gutterBox = await gutter.boundingBox()
    if (!gutterBox) {
      throw new Error('sidebar splitter gutter has no bounding box')
    }
    await comfyPage.page.mouse.move(
      gutterBox.x + gutterBox.width / 2,
      gutterBox.y + gutterBox.height / 2
    )
    await comfyPage.page.mouse.down()
    await comfyPage.page.mouse.move(900, gutterBox.y + gutterBox.height / 2, {
      steps: 12
    })
    await comfyPage.page.mouse.up()

    await tab.assetCards.first().click()
    await expect(tab.selectionFooter).toBeVisible()

    const sidebar = comfyPage.page.locator('.side-bar-panel').first()
    await expect
      .poll(async () => (await sidebar.boundingBox())?.width ?? 0)
      .toBeGreaterThan(520)
    await expect
      .poll(async () => {
        const bar = await tab.selectionFooter.boundingBox()
        const side = await sidebar.boundingBox()
        return bar && side ? side.width - bar.width : 0
      })
      .toBeGreaterThan(100)
  })
})

cloudTest.describe('Assets sidebar - cloud exports', { tag: '@cloud' }, () => {
  cloudTest(
    'Single job selection uses preserve naming strategy',
    async ({ comfyPage, mockCloudAssetSidebarData }) => {
      void mockCloudAssetSidebarData
      const exportRequests = await comfyPage.assets.captureAssetExportRequests()

      const tab = comfyPage.menu.assetsTab
      await tab.open()

      await tab.assetCards.first().click()
      await expect(tab.downloadSelectedButton).toBeVisible()

      await tab.downloadSelectedButton.click()

      await expect.poll(() => exportRequests).toHaveLength(1)

      const payload = exportRequests[0]
      expect(payload.job_ids).toEqual(['job-gamma'])
      expect(payload.job_asset_name_filters).toBeUndefined()
      expect(payload.naming_strategy).toBe('preserve')
    }
  )

  cloudTest(
    'Multiple selected assets from one job use preserve naming strategy',
    async ({ comfyPage, mockCloudAssetSidebarData }) => {
      void mockCloudAssetSidebarData
      const exportRequests = await comfyPage.assets.captureAssetExportRequests()
      await comfyPage.assets.mockJobDetail('job-gamma', JOB_GAMMA_DETAIL)

      const tab = comfyPage.menu.assetsTab
      await tab.open()

      await tab.assetCards
        .first()
        .getByRole('button', { name: 'See more outputs' })
        .click()
      await expect(tab.backToAssetsButton).toBeVisible()
      await expect.poll(() => tab.assetCards.count()).toBe(2)

      await tab.assetCards.first().click()
      await comfyPage.page.keyboard.down('Control')
      await tab.assetCards.nth(1).click()
      await comfyPage.page.keyboard.up('Control')

      await expect(tab.selectedCards).toHaveCount(2)
      await tab.downloadSelectedButton.click()

      await expect.poll(() => exportRequests).toHaveLength(1)

      const payload = exportRequests[0]
      expect(payload.job_ids).toEqual(['job-gamma'])
      expect(payload.job_asset_name_filters?.['job-gamma']?.toSorted()).toEqual(
        ['abstract_art.png', 'abstract_art_alt.png']
      )
      expect(payload.naming_strategy).toBe('preserve')
    }
  )

  cloudTest(
    'Multiple selected jobs use job-time naming strategy',
    async ({ comfyPage, mockCloudAssetSidebarData }) => {
      void mockCloudAssetSidebarData
      const exportRequests = await comfyPage.assets.captureAssetExportRequests()

      const tab = comfyPage.menu.assetsTab
      await tab.open()

      await tab.assetCards.nth(1).click()
      await comfyPage.page.keyboard.down('Control')
      await tab.assetCards.nth(2).click()
      await comfyPage.page.keyboard.up('Control')

      await expect(tab.selectedCards).toHaveCount(2)
      await tab.downloadSelectedButton.click()

      await expect.poll(() => exportRequests).toHaveLength(1)

      const payload = exportRequests[0]
      expect(payload.job_ids?.toSorted()).toEqual(['job-alpha', 'job-beta'])
      expect(payload.job_asset_name_filters).toBeUndefined()
      expect(payload.naming_strategy).toBe('group_by_job_time')
    }
  )
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

    // Queue polling also calls /jobs, so wait for completed history only.
    const firstRequest = comfyPage.page.waitForRequest((req) => {
      if (!/\/api\/jobs\?/.test(req.url())) return false
      const url = new URL(req.url())
      const status = url.searchParams.get('status') ?? ''
      return status.includes('completed')
    })

    const tab = comfyPage.menu.assetsTab
    await tab.open()

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

    const initialCount = await tab.assetCards.count()

    await tab.assetCards.first().click({ button: 'right' })
    await tab.contextMenuItem('Delete').click()

    const dialog = comfyPage.confirmDialog.root
    await expect(dialog).toBeVisible()

    await comfyPage.confirmDialog.delete.click()

    await expect(dialog).toBeHidden()
    await expect(tab.assetCards).toHaveCount(initialCount - 1)

    const successToast = comfyPage.page.locator('.p-toast-message-success')
    await expect(successToast).toBeVisible()
  })

  test('Cancelling delete preserves asset', async ({ comfyPage }) => {
    const tab = comfyPage.menu.assetsTab
    await tab.open()

    const initialCount = await tab.assetCards.count()

    await tab.assetCards.first().click({ button: 'right' })
    await tab.contextMenuItem('Delete').click()

    const dialog = comfyPage.confirmDialog.root
    await expect(dialog).toBeVisible()

    await comfyPage.confirmDialog.reject.click()

    await expect(dialog).toBeHidden()
    await expect(tab.assetCards).toHaveCount(initialCount)
  })
})

// ==========================================================================
// 12. Media type filter (cloud-only)
// ==========================================================================

const MIXED_MEDIA_JOBS: RawJobListItem[] = [
  createMockJob({
    id: 'job-image',
    create_time: 1000,
    execution_start_time: 1000,
    execution_end_time: 1010,
    preview_output: {
      filename: 'photo.png',
      subfolder: '',
      type: 'output',
      nodeId: '1',
      mediaType: 'images'
    },
    outputs_count: 1
  }),
  createMockJob({
    id: 'job-video',
    create_time: 2000,
    execution_start_time: 2000,
    execution_end_time: 2010,
    preview_output: {
      filename: 'clip.mp4',
      subfolder: '',
      type: 'output',
      nodeId: '2',
      mediaType: 'video'
    },
    outputs_count: 1
  }),
  createMockJob({
    id: 'job-audio',
    create_time: 3000,
    execution_start_time: 3000,
    execution_end_time: 3010,
    preview_output: {
      filename: 'track.mp3',
      subfolder: '',
      type: 'output',
      nodeId: '3',
      mediaType: 'audio'
    },
    outputs_count: 1
  })
]

// Filter button is guarded by isCloud; cloud CI needs authenticated setup.
test.describe('Assets sidebar - media type filter', () => {
  test.fixme(true, 'Requires DISTRIBUTION=cloud build with auth bypass')

  test.beforeEach(async ({ comfyPage }) => {
    await comfyPage.assets.mockOutputHistory(MIXED_MEDIA_JOBS)
    await comfyPage.assets.mockInputFiles([])
    await comfyPage.setup()
  })

  test.afterEach(async ({ comfyPage }) => {
    await comfyPage.assets.clearMocks()
  })

  test('Filter menu shows media type options', async ({ comfyPage }) => {
    const tab = comfyPage.menu.assetsTab
    await tab.open()

    await tab.openFilterMenu()

    await expect(tab.filterCheckbox('Image')).toBeVisible()
    await expect(tab.filterCheckbox('Video')).toBeVisible()
    await expect(tab.filterCheckbox('Audio')).toBeVisible()
    await expect(tab.filterCheckbox('3D')).toBeVisible()
  })

  test('Unchecking image filter hides image assets', async ({ comfyPage }) => {
    const tab = comfyPage.menu.assetsTab
    await tab.open()

    const initialCount = tab.assetCards
    await expect(
      initialCount,
      'All three mixed-media jobs should render'
    ).toHaveCount(3)

    await tab.openFilterMenu()
    await tab.filterCheckbox('Image').click()

    await expect(tab.assetCards).toHaveCount(1, { timeout: 5000 })
    await expect(tab.getAssetCardByName('photo.png')).toBeVisible()
  })

  test('Re-enabling filter restores hidden assets', async ({ comfyPage }) => {
    const tab = comfyPage.menu.assetsTab
    await tab.open()

    const initialCount = await tab.assetCards.count()

    await tab.openFilterMenu()
    await tab.filterCheckbox('Image').click()
    await expect(tab.assetCards).toHaveCount(1, { timeout: 5000 })

    await tab.filterCheckbox('Image').click()
    await expect(tab.assetCards).toHaveCount(initialCount, { timeout: 5000 })
  })
})

test.describe('Assets sidebar - drag and drop', () => {
  test('Dragging outputs from assets skips upload', async ({ comfyPage }) => {
    await comfyPage.assets.mockOutputHistory([
      createMockJob({
        id: 'job',
        preview_output: {
          filename: `test.png`,
          type: 'temp',
          nodeId: '1',
          mediaType: 'images'
        }
      })
    ])
    await comfyPage.page.route('**/upload/image', (route) => {
      expect(true, 'file is not uploaded').toBe(false)
      return route.fulfill({ status: 405 })
    })

    await comfyPage.workflow.loadWorkflow('widgets/load_image_widget')

    await comfyPage.canvas.focus()
    await comfyPage.page.keyboard.press('.')
    const { assetsTab } = comfyPage.menu
    await assetsTab.open()
    await assetsTab.waitForAssets()
    await expect(assetsTab.assetCards).toHaveCount(1)

    const targetPosition =
      (await comfyPage.canvasOps.getNodeCenterByTitle('Load Image')) ??
      undefined

    await assetsTab.assetCards.dragTo(comfyPage.canvas, { targetPosition })

    const nodes = await comfyPage.nodeOps.getNodeRefsByType('LoadImage')
    const fileComboWidget = await nodes[0].getWidget(0)
    await expect.poll(() => fileComboWidget.getValue()).toBe('test.png [temp]')
  })

  test('Loading as workflow reuses asset name', async ({ comfyPage }) => {
    await comfyPage.assets.mockOutputHistory([
      createMockJob({
        id: 'job',
        preview_output: {
          filename: `testimage.png`,
          type: 'temp',
          nodeId: '1',
          mediaType: 'images'
        }
      })
    ])
    const path = comfyPage.assetPath('workflowInMedia/workflow.webp')
    await comfyPage.page.route('**/view?**', (route) => route.fulfill({ path }))

    const { assetsTab } = comfyPage.menu
    await assetsTab.open()
    await assetsTab.waitForAssets()
    await expect(assetsTab.assetCards).toHaveCount(1)

    const targetPosition = { x: 400, y: 100 }
    await assetsTab.assetCards.dragTo(comfyPage.canvas, { targetPosition })

    const getTabName = () => comfyPage.menu.topbar.getActiveTabName()
    await expect.poll(getTabName).toContain('testimage')
  })
})

test('Insert as node', { tag: '@vue-nodes' }, async ({ comfyPage }) => {
  await comfyPage.assets.mockOutputHistory([
    createMockJob({
      id: 'job1',
      preview_output: {
        filename: `1.png`,
        type: 'temp',
        nodeId: '1',
        mediaType: 'images'
      }
    }),
    createMockJob({
      id: 'job2',
      preview_output: {
        filename: `2.png`,
        type: 'output',
        nodeId: '1',
        mediaType: 'images'
      }
    }),
    createMockJob({
      id: 'job2',
      preview_output: {
        filename: `3.png`,
        type: 'input',
        nodeId: '1',
        mediaType: 'images'
      }
    })
  ])
  const { assetsTab } = comfyPage.menu
  await assetsTab.open()
  await assetsTab.waitForAssets()
  await expect(assetsTab.assetCards).toHaveCount(3)
  for (const [index, expectedName] of [
    [0, '1.png [temp]'],
    [1, '2.png [output]'],
    [2, '3.png']
  ] as const) {
    await comfyPage.nodeOps.clearGraph()
    await assetsTab.assetCards.nth(index).scrollIntoViewIfNeeded()
    await assetsTab.assetCards.nth(index).click({ button: 'right' })

    await expect(comfyPage.contextMenu.primeVueMenu).toBeVisible()
    await comfyPage.contextMenu.primeVueMenu.getByText('Insert as node').click()

    await expect.poll(() => comfyPage.vueNodes.getNodeCount()).toBe(1)
    const nodes = await comfyPage.nodeOps.getNodeRefsByType('LoadImage')
    const fileWidget = await nodes[0].getWidget(0)
    await expect.poll(() => fileWidget.getValue()).toBe(expectedName)
  }
})
