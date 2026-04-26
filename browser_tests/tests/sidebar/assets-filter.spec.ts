import { expect } from '@playwright/test'

import type {
  Asset,
  JobsListResponse,
  ListAssetsResponse
} from '@comfyorg/ingest-types'
import { comfyPageFixture } from '@e2e/fixtures/ComfyPage'
import { createMixedMediaJobs } from '@e2e/fixtures/helpers/AssetsHelper'

// The assets sidebar's media-type filter menu only renders in cloud mode
// (`MediaAssetFilterBar.vue` gates `MediaAssetFilterButton` behind `isCloud`).
// We tag tests `@cloud` so they run against the cloud Playwright project,
// and register both `/api/assets` and `/api/jobs` route handlers as auto
// fixtures — Playwright runs auto fixtures before the `comfyPage` fixture's
// internal `setup()`, so the page first-loads with mocks already in place.
// See cloud-asset-default.spec.ts for the same pattern.

const MIXED_JOBS = createMixedMediaJobs(['images', 'video', 'audio', '3D'])

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

test.describe('Assets sidebar - media type filter', { tag: '@cloud' }, () => {
  test('Filter menu opens and exposes all four media-type checkboxes', async ({
    comfyPage
  }) => {
    const tab = comfyPage.menu.assetsTab
    await tab.open()
    await tab.waitForAssets(MIXED_JOBS.length)

    await tab.openFilterMenu()

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
    await tab.waitForAssets(MIXED_JOBS.length)

    await tab.openFilterMenu()
    await tab.toggleMediaTypeFilter('image')

    await expect(tab.assetCards).toHaveCount(1)
    await expect(tab.getAssetCardByName(imageCardName)).toBeVisible()
    await expect(tab.getAssetCardByName(videoCardName)).toHaveCount(0)
    await expect(tab.getAssetCardByName(audioCardName)).toHaveCount(0)
    await expect(tab.getAssetCardByName(threeDCardName)).toHaveCount(0)
  })

  test('Selecting only "Video" hides non-video assets', async ({
    comfyPage
  }) => {
    const tab = comfyPage.menu.assetsTab
    await tab.open()
    await tab.waitForAssets(MIXED_JOBS.length)

    await tab.openFilterMenu()
    await tab.toggleMediaTypeFilter('video')

    await expect(tab.assetCards).toHaveCount(1)
    await expect(tab.getAssetCardByName(videoCardName)).toBeVisible()
  })

  test('Selecting only "Audio" hides non-audio assets', async ({
    comfyPage
  }) => {
    const tab = comfyPage.menu.assetsTab
    await tab.open()
    await tab.waitForAssets(MIXED_JOBS.length)

    await tab.openFilterMenu()
    await tab.toggleMediaTypeFilter('audio')

    await expect(tab.assetCards).toHaveCount(1)
    await expect(tab.getAssetCardByName(audioCardName)).toBeVisible()
  })

  test('Selecting only "3D" hides non-3D assets', async ({ comfyPage }) => {
    const tab = comfyPage.menu.assetsTab
    await tab.open()
    await tab.waitForAssets(MIXED_JOBS.length)

    await tab.openFilterMenu()
    await tab.toggleMediaTypeFilter('3d')

    await expect(tab.assetCards).toHaveCount(1)
    await expect(tab.getAssetCardByName(threeDCardName)).toBeVisible()
  })

  test('Multiple filters combine via OR (image + video)', async ({
    comfyPage
  }) => {
    const tab = comfyPage.menu.assetsTab
    await tab.open()
    await tab.waitForAssets(MIXED_JOBS.length)

    await tab.openFilterMenu()
    await tab.toggleMediaTypeFilter('image')
    await tab.toggleMediaTypeFilter('video')

    await expect(tab.assetCards).toHaveCount(2)
    await expect(tab.getAssetCardByName(imageCardName)).toBeVisible()
    await expect(tab.getAssetCardByName(videoCardName)).toBeVisible()
    await expect(tab.getAssetCardByName(audioCardName)).toHaveCount(0)
    await expect(tab.getAssetCardByName(threeDCardName)).toHaveCount(0)
  })

  test('Unchecking the active filter restores the full list', async ({
    comfyPage
  }) => {
    const tab = comfyPage.menu.assetsTab
    await tab.open()
    await tab.waitForAssets(MIXED_JOBS.length)

    await tab.openFilterMenu()
    await tab.toggleMediaTypeFilter('image')
    await expect(tab.assetCards).toHaveCount(1)

    await tab.toggleMediaTypeFilter('image')
    await expect(tab.assetCards).toHaveCount(MIXED_JOBS.length)
  })
})
