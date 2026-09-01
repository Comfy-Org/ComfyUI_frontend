import { expect, mergeTests } from '@playwright/test'

import { comfyPageFixture } from '@e2e/fixtures/ComfyPage'
import {
  createMockJob,
  createMockJobs
} from '@e2e/fixtures/helpers/AssetsHelper'
import { jobsRouteFixture } from '@e2e/fixtures/jobsRouteFixture'
import {
  mockGeneratedSidebarRoutes,
  multiOutputJob,
  multiOutputJobDetail,
  previewableCountJob,
  previewableCountJobDetail
} from '@e2e/tests/assets/routeMockFixtures'
import {
  JOB_GAMMA_DETAIL,
  SAMPLE_IMPORTED_FILES,
  SAMPLE_JOBS
} from '@e2e/tests/assets/sidebarFixtures'

const test = comfyPageFixture
const routeTest = mergeTests(comfyPageFixture, jobsRouteFixture)

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

test.describe('Assets sidebar - grid view display', () => {
  test.beforeEach(async ({ comfyPage }) => {
    await comfyPage.assets.mockOutputHistory(SAMPLE_JOBS)
    await comfyPage.assets.mockInputFiles(SAMPLE_IMPORTED_FILES)
    await comfyPage.setup()
  })

  test.afterEach(async ({ comfyPage }) => {
    await comfyPage.assets.clearMocks()
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

test.describe('Assets sidebar - view mode', () => {
  test.beforeEach(async ({ comfyPage }) => {
    await comfyPage.assets.mockOutputHistory(SAMPLE_JOBS)
    await comfyPage.assets.mockInputFiles(SAMPLE_IMPORTED_FILES)
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

  test('Can switch from list to large grid', async ({ comfyPage }) => {
    const tab = comfyPage.menu.assetsTab
    await tab.open()

    await tab.openSettingsMenu()
    await tab.listViewOption.click()
    await expect(tab.listViewItems.first()).toBeVisible()

    await tab.gridLargeOption.click()
    await tab.waitForAssets()

    await expect(tab.assetCards.first()).toBeVisible()
  })

  test('Small grid remains active across asset views', async ({
    comfyPage
  }) => {
    await comfyPage.assets.mockJobDetail('job-gamma', JOB_GAMMA_DETAIL)

    const tab = comfyPage.menu.assetsTab
    await tab.open()

    const largeCardWidth = await tab.getFirstGridItemWidth()

    await tab.openSettingsMenu()
    await tab.gridSmallOption.click()

    await expect
      .poll(() => tab.getFirstGridItemWidth())
      .toBeLessThan(largeCardWidth)
    await expect
      .poll(() =>
        comfyPage.page.evaluate(() =>
          localStorage.getItem('Comfy.Assets.Sidebar.ViewMode')
        )
      )
      .toBe('grid-small')

    await tab.switchToImported()

    await expect(tab.assetCards.first()).toBeVisible()
    await expect
      .poll(() => tab.getFirstGridItemWidth())
      .toBeLessThan(largeCardWidth)

    await tab.switchToGenerated()
    await tab.assetCards
      .first()
      .getByRole('button', { name: 'See more outputs' })
      .click()

    await expect(tab.backToAssetsButton).toBeVisible()
    await expect.poll(() => tab.assetCards.count()).toBe(2)
    await expect
      .poll(() => tab.getFirstGridItemWidth())
      .toBeLessThan(largeCardWidth)
  })
})

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
    await expect(tab.gridSmallOption).toBeVisible()
    await expect(tab.gridLargeOption).toBeVisible()
  })
})

routeTest.describe('Assets sidebar - previews and job detail', () => {
  routeTest.beforeEach(async ({ jobsRoutes, page }) => {
    await mockGeneratedSidebarRoutes(page, jobsRoutes)
  })

  routeTest(
    'renders generated and imported assets with image previews',
    async ({ comfyPage }) => {
      const tab = comfyPage.menu.assetsTab

      await comfyPage.setup()
      await tab.open()

      await expect(tab.getAssetCardByName('alpha')).toBeVisible()
      await expect(tab.getAssetCardByName('beta')).toBeVisible()
      await expect(
        comfyPage.page.getByRole('img', { name: 'alpha.png' })
      ).toHaveJSProperty('naturalWidth', 1)

      await tab.switchToImported()

      await expect(tab.getAssetCardByName('imported')).toBeVisible()
      await expect(
        comfyPage.page.getByRole('img', { name: 'imported.png' })
      ).toHaveJSProperty('naturalWidth', 1)
    }
  )

  routeTest(
    'opens previews for generated and imported images',
    async ({ comfyPage }) => {
      const tab = comfyPage.menu.assetsTab

      await comfyPage.setup()
      await tab.open()

      await comfyPage.page.getByRole('img', { name: 'alpha.png' }).dblclick()
      await expect(comfyPage.mediaLightbox.root).toBeVisible()
      await expect(
        comfyPage.mediaLightbox.root.getByRole('img', {
          name: 'alpha.png'
        })
      ).toBeVisible()

      await comfyPage.mediaLightbox.closeButton.click()
      await expect(comfyPage.mediaLightbox.root).toBeHidden()

      await tab.switchToImported()

      await comfyPage.page.getByRole('img', { name: 'imported.png' }).dblclick()
      await expect(comfyPage.mediaLightbox.root).toBeVisible()
      await expect(
        comfyPage.mediaLightbox.root.getByRole('img', {
          name: 'imported.png'
        })
      ).toBeVisible()
    }
  )

  routeTest(
    'loads full generated job outputs from job detail',
    async ({ comfyPage, jobsRoutes }) => {
      const tab = comfyPage.menu.assetsTab

      await jobsRoutes.mockJobsHistory([multiOutputJob])
      await jobsRoutes.mockJobDetail('multi-output', multiOutputJobDetail)

      await comfyPage.setup()
      await tab.open()

      await tab
        .getAssetCardByName('multi-output-a')
        .getByRole('button', { name: 'See more outputs' })
        .click()

      await expect(tab.backToAssetsButton).toBeVisible()
      const folderJobId = comfyPage.page.getByText('multi-output', {
        exact: true
      })
      await expect(folderJobId).toBeVisible()
      await expect(
        comfyPage.page.getByRole('button', { name: 'Copy Job ID' })
      ).toBeVisible()
      await expect(tab.getAssetCardByName('multi-output-b')).toBeVisible()
      await expect(
        comfyPage.page.getByRole('img', { name: 'multi-output-b.png' })
      ).toHaveJSProperty('naturalWidth', 1)
    }
  )

  routeTest(
    'group badge shows previewable_outputs_count, matching the expanded drilldown',
    async ({ comfyPage, jobsRoutes }) => {
      const tab = comfyPage.menu.assetsTab

      await jobsRoutes.mockJobsHistory([previewableCountJob])
      await jobsRoutes.mockJobDetail(
        'previewable-count-job',
        previewableCountJobDetail
      )

      await comfyPage.setup()
      await tab.open()

      const badge = tab
        .getAssetCardByName('previewable-count-a')
        .getByRole('button', { name: 'See more outputs' })
      await expect(badge).toHaveText('2')

      await badge.click()
      await expect(tab.backToAssetsButton).toBeVisible()
      await expect(tab.assetCards).toHaveCount(2)
    }
  )
})
