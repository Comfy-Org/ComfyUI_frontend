import { expect } from '@playwright/test'

import type { Asset, ListAssetsResponse } from '@comfyorg/ingest-types'
import { comfyPageFixture } from '@e2e/fixtures/ComfyPage'
import { createMixedMediaJobs } from '@e2e/fixtures/helpers/AssetsHelper'

// The assets sidebar's media-type filter menu only renders in cloud mode
// (`MediaAssetFilterBar.vue` gates `MediaAssetFilterButton` behind `isCloud`).
// We piggyback on the @cloud project's compile-time `__DISTRIBUTION__='cloud'`
// build and additionally stub `/api/assets` so the assets store doesn't poison
// itself on first load (same pattern as cloud-asset-default.spec.ts).

function makeAssetsResponse(assets: Asset[]): ListAssetsResponse {
  return { assets, total: assets.length, has_more: false }
}

const test = comfyPageFixture.extend<{ stubCloudAssets: void }>({
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
  ]
})

const MIXED_JOBS = createMixedMediaJobs(['images', 'video', 'audio', '3D'])

// Derive the filenames from the fixture so the test fails loudly if the
// helper's id/extension scheme ever drifts. `preview_output` is optional in
// the schema; `expectFilename` collapses the optional chain into a hard
// assertion.
function expectFilename(index: number): string {
  const filename = MIXED_JOBS[index]?.preview_output?.filename
  if (!filename) {
    throw new Error(
      `MIXED_JOBS[${index}].preview_output.filename is missing — ` +
        'createMixedMediaJobs contract changed.'
    )
  }
  return filename
}

const imageCardName = expectFilename(0)
const videoCardName = expectFilename(1)
const audioCardName = expectFilename(2)
const threeDCardName = expectFilename(3)

test.describe('Assets sidebar - media type filter', { tag: '@cloud' }, () => {
  test.beforeEach(async ({ comfyPage }) => {
    await comfyPage.assets.mockOutputHistory(MIXED_JOBS)
    await comfyPage.assets.mockInputFiles([])
    await comfyPage.setup()
  })

  test.afterEach(async ({ comfyPage }) => {
    await comfyPage.assets.clearMocks()
  })

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
