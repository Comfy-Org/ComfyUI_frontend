import { expect } from '@playwright/test'

import type { ListAssetsResponse } from '@comfyorg/ingest-types'
import { comfyPageFixture as test } from '@e2e/fixtures/ComfyPage'
import { createMockJob } from '@e2e/fixtures/helpers/AssetsHelper'

const emptyAssetsResponse: ListAssetsResponse = {
  assets: [],
  total: 0,
  has_more: false
}

test.describe('Assets sidebar flag-off isolation', { tag: '@oss' }, () => {
  test.use({ initialFeatureFlags: { assets: false } })

  test('uses history without requesting the Asset API', async ({
    comfyPage,
    page
  }) => {
    const assetListRequests: string[] = []
    await page.route(/\/api\/assets(?:\?.*)?$/, async (route) => {
      assetListRequests.push(route.request().url())
      await route.fulfill({
        json: emptyAssetsResponse
      })
    })
    await comfyPage.assets.mockOutputHistory([
      createMockJob({ id: 'legacy-output' })
    ])
    await comfyPage.assets.mockInputFiles([])

    const tab = comfyPage.menu.assetsTab
    await tab.open({ waitForAssets: false })
    await expect(
      tab.getAssetCardByName('output_legacy-output').or(tab.emptyStateMessage)
    ).toBeVisible()

    expect(assetListRequests).toEqual([])
    await expect(tab.getAssetCardByName('output_legacy-output')).toBeVisible()
    await expect(tab.filterButton).toHaveCount(0)
  })
})

test.describe(
  'Assets sidebar flag-off isolation on Cloud',
  { tag: '@cloud' },
  () => {
    test.use({ initialFeatureFlags: { assets: false } })

    test('falls back to history without Asset API controls', async ({
      comfyPage,
      page
    }) => {
      // Restore the executing assertion after the Cloud flag-off harness is fixed:
      // https://github.com/Comfy-Org/ComfyUI_frontend/issues/16380
      test.fixme(
        true,
        'Cloud currently enables Assets unconditionally instead of honoring the off flag'
      )

      const assetListRequests: string[] = []
      await page.route(/\/api\/assets(?:\?.*)?$/, async (route) => {
        assetListRequests.push(route.request().url())
        await route.fulfill({
          json: emptyAssetsResponse
        })
      })
      await comfyPage.assets.mockOutputHistory([
        createMockJob({ id: 'legacy-output' })
      ])
      await comfyPage.assets.mockInputFiles([])

      const tab = comfyPage.menu.assetsTab
      await tab.open({ waitForAssets: false })
      await expect(
        tab.getAssetCardByName('output_legacy-output').or(tab.emptyStateMessage)
      ).toBeVisible()

      expect(assetListRequests).toEqual([])
      await expect(tab.getAssetCardByName('output_legacy-output')).toBeVisible()
      await expect(tab.filterButton).toHaveCount(0)
    })
  }
)
