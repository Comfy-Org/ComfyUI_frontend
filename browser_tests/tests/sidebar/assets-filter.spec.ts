import { expect } from '@playwright/test'

import type {
  Asset,
  JobsListResponse,
  ListAssetsResponse
} from '@comfyorg/ingest-types'
import { comfyPageFixture } from '@e2e/fixtures/ComfyPage'
import { createMixedMediaJobs } from '@e2e/fixtures/helpers/AssetsHelper'

// The assets sidebar's attribute filter menu only renders in cloud mode
// (`MediaAssetFilterBar.vue` gates `MediaAssetFilterButton` behind `isCloud`).
// We tag tests `@cloud` so they run against the cloud Playwright project,
// and register both `/api/assets` and `/api/jobs` route handlers as auto
// fixtures — Playwright runs auto fixtures before the `comfyPage` fixture's
// internal `setup()`, so the page first-loads with mocks already in place.
// See cloud-asset-default.spec.ts for the same pattern.
//
// Use `waitForAssets()` not `waitForAssets(MIXED_JOBS.length)`: VirtualGrid can
// virtualize the 3D card out of the initial render (#11635). Filtering reads the
// full store, so the per-filter count assertions still cover the behavior.

const now = Date.now()
const ages = [0, 86_400_000, 8 * 86_400_000, 40 * 86_400_000]
const MIXED_JOBS = createMixedMediaJobs(['images', 'video', 'audio', '3D']).map(
  (job, index) => ({
    ...job,
    create_time: now - (ages[index] ?? 0)
  })
)

// MediaAssetCard renders the filename *without* extension via
// getFilenameDetails(...).filename, so card-text matching uses the basename.
function expectCardText(index: number): string {
  const filename = MIXED_JOBS[index]?.preview_output?.filename
  if (!filename) {
    throw new Error(
      `MIXED_JOBS[${index}].preview_output.filename is missing — ` +
        'createMixedMediaJobs contract changed.'
    )
  }
  return filename.replace(/\.[^.]+$/, '')
}

const imageCardName = expectCardText(0)
const videoCardName = expectCardText(1)
const audioCardName = expectCardText(2)
const threeDCardName = expectCardText(3)

function makeAssetsResponse(assets: Asset[]): ListAssetsResponse {
  return { assets, total: assets.length, has_more: false }
}

function makeJobsResponseBody() {
  return {
    jobs: MIXED_JOBS,
    pagination: {
      offset: 0,
      limit: MIXED_JOBS.length,
      total: MIXED_JOBS.length,
      has_more: false
    }
  } satisfies {
    jobs: unknown[]
    pagination: JobsListResponse['pagination']
  }
}

const test = comfyPageFixture.extend<{
  stubCloudAssets: void
  stubJobs: void
  stubInputFiles: void
}>({
  stubCloudAssets: [
    async ({ page }, use) => {
      const pattern = '**/api/assets?*'
      await page.route(pattern, (route) =>
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(makeAssetsResponse([]))
        })
      )
      await use()
      await page.unroute(pattern)
    },
    { auto: true }
  ],
  stubJobs: [
    async ({ page }, use) => {
      const pattern = /\/api\/jobs(?:\?.*)?$/
      await page.route(pattern, (route) =>
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(makeJobsResponseBody())
        })
      )
      await use()
      await page.unroute(pattern)
    },
    { auto: true }
  ],
  stubInputFiles: [
    async ({ page }, use) => {
      const pattern = /\/internal\/files\/input(?:\?.*)?$/
      await page.route(pattern, (route) =>
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify([])
        })
      )
      await use()
      await page.unroute(pattern)
    },
    { auto: true }
  ]
})

test.describe('Assets sidebar - attribute filters', { tag: '@cloud' }, () => {
  test('Filter menu groups media type and date under Attribute', async ({
    comfyPage
  }) => {
    const tab = comfyPage.menu.assetsTab
    await tab.open()
    await tab.waitForAssets()

    await tab.openFilterMenu()

    await expect(tab.mediaTypeFilterMenuItem).toBeVisible()
    await expect(tab.dateFilterMenuItem).toBeVisible()

    await tab.openMediaTypeFilterMenu()

    await expect(tab.filterImageCheckbox).toBeVisible()
    await expect(tab.filterVideoCheckbox).toBeVisible()
    await expect(tab.filterAudioCheckbox).toBeVisible()
    await expect(tab.filter3DCheckbox).toBeVisible()
    for (const cb of [
      tab.filterImageCheckbox,
      tab.filterVideoCheckbox,
      tab.filterAudioCheckbox,
      tab.filter3DCheckbox
    ]) {
      await expect(cb).toHaveAttribute('aria-checked', 'false')
    }
  })

  test('Selecting only "Image" hides non-image assets', async ({
    comfyPage
  }) => {
    const tab = comfyPage.menu.assetsTab
    await tab.open()
    await tab.waitForAssets()

    await tab.openFilterMenu()
    await tab.toggleMediaTypeFilter('image')

    await expect(tab.assetCards).toHaveCount(1)
    await expect(tab.getAssetCardByName(imageCardName)).toBeVisible()
    await expect(tab.getAssetCardByName(videoCardName)).toHaveCount(0)
    await expect(tab.getAssetCardByName(audioCardName)).toHaveCount(0)
    await expect(tab.getAssetCardByName(threeDCardName)).toHaveCount(0)
  })

  test('Applied filters survive sidebar remounts', async ({ comfyPage }) => {
    const tab = comfyPage.menu.assetsTab
    const imageFilter = tab.removeFilterButton('Image')
    const dateFilter = tab.removeFilterButton('Past 7 days')

    await tab.open()
    await tab.waitForAssets()
    await tab.openFilterMenu()
    await tab.selectDateFilter('Past 7 days')
    await tab.toggleMediaTypeFilter('image')
    await tab.closeFilterMenu()

    await expect(imageFilter).toBeVisible()
    await expect(dateFilter).toBeVisible()
    await expect(tab.assetCards).toHaveCount(1)

    await comfyPage.menu.nodeLibraryTab.tabButton.click()
    await expect(tab.generatedTab).toBeHidden()
    await tab.open()

    await expect(imageFilter).toBeVisible()
    await expect(dateFilter).toBeVisible()
    await expect(tab.assetCards).toHaveCount(1)

    await tab.close()
    await expect(tab.generatedTab).toBeHidden()
    await tab.open()

    await expect(imageFilter).toBeVisible()
    await expect(dateFilter).toBeVisible()
    await expect(tab.assetCards).toHaveCount(1)
  })

  test('Date and media filters compose and applied controls can clear them', async ({
    comfyPage,
    page
  }) => {
    const tab = comfyPage.menu.assetsTab
    await tab.open()
    await tab.waitForAssets()

    await tab.openFilterMenu()
    await tab.selectDateFilter('Past 7 days')
    await expect(tab.filterButton).toHaveAttribute('aria-expanded', 'true')
    await tab.toggleMediaTypeFilter('image')
    await tab.closeFilterMenu()

    await expect(tab.assetCards).toHaveCount(1)
    await expect(tab.getAssetCardByName(imageCardName)).toBeVisible()
    await expect(tab.removeFilterButton('Image')).toBeVisible()
    await expect(tab.removeFilterButton('Past 7 days')).toBeVisible()

    await tab.removeFilterButton('Image').click()

    await expect(tab.assetCards).toHaveCount(2)
    await expect(tab.getAssetCardByName(imageCardName)).toBeVisible()
    await expect(tab.getAssetCardByName(videoCardName)).toBeVisible()
    await expect(tab.removeFilterButton('Image')).toHaveCount(0)

    await page.getByRole('button', { name: 'Clear all' }).click()

    await expect(tab.getAssetCardByName(audioCardName)).toBeVisible()
    await expect(tab.removeFilterButton('Past 7 days')).toHaveCount(0)
  })

  test('Unchecking the active filter restores previously hidden cards', async ({
    comfyPage
  }) => {
    const tab = comfyPage.menu.assetsTab
    await tab.open()
    await tab.waitForAssets()

    await tab.openFilterMenu()
    await tab.toggleMediaTypeFilter('image')
    await expect(tab.assetCards).toHaveCount(1)

    await tab.toggleMediaTypeFilter('image')

    // TODO(#11635): the 3D preview card does not remount after a filter
    // toggle restores it (only image/video/audio reappear). Image, video,
    // and audio cover the restoration path; once #11635 is fixed, add the
    // 3D card back to this assertion list.
    await expect(tab.getAssetCardByName(imageCardName)).toBeVisible({
      timeout: 10_000
    })
    await expect(tab.getAssetCardByName(videoCardName)).toBeVisible()
    await expect(tab.getAssetCardByName(audioCardName)).toBeVisible()
  })
})
