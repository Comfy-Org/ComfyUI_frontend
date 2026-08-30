import { expect } from '@playwright/test'
import type { Asset, ListAssetsResponse } from '@comfyorg/ingest-types'

import { comfyPageFixture as baseTest } from '@e2e/fixtures/ComfyPage'
import { createMockJob } from '@e2e/fixtures/helpers/AssetsHelper'
import { mockBilling } from '@e2e/fixtures/utils/cloudBillingMocks'
import { mockCloudBoot } from '@e2e/fixtures/utils/cloudBootMocks'

const test = baseTest.extend({
  page: async ({ page }, use, testInfo) => {
    if (testInfo.tags.includes('@cloud')) {
      await mockCloudBoot(page, {
        features: {},
        settings: {
          'Comfy.Queue.QPOV2': false,
          'Comfy.RightSidePanel.ShowErrorsTab': false,
          'Comfy.TutorialCompleted': true,
          'Comfy.UseNewMenu': 'Top',
          'Comfy.VersionCompatibility.DisableWarnings': true
        }
      })
      await mockBilling(page)
    }
    await use(page)
  }
})

const contractTest = test.extend<{ assetApiRequests: URL[] }>({
  assetApiRequests: async ({ page }, use) => {
    const requests: URL[] = []
    const outputAsset = {
      id: 'output-asset',
      name: 'enabled-output.png',
      mime_type: 'image/png',
      tags: ['output'],
      preview_url: '/api/view?filename=enabled-output.png&type=output',
      created_at: '2026-08-29T00:00:00.000Z',
      updated_at: '2026-08-29T00:00:00.000Z'
    } satisfies Asset
    const inputAsset = {
      id: 'input-asset',
      name: 'enabled-input.png',
      mime_type: 'image/png',
      tags: ['input'],
      preview_url: '/api/view?filename=enabled-input.png&type=input',
      created_at: '2026-08-29T00:00:00.000Z',
      updated_at: '2026-08-29T00:00:00.000Z'
    } satisfies Asset

    await page.route(/\/api\/assets(?:\?.*)?$/, async (route) => {
      const url = new URL(route.request().url())
      requests.push(url)
      const assets =
        url.searchParams.get('include_tags') === 'input'
          ? [inputAsset]
          : [outputAsset]
      const response = {
        assets,
        total: assets.length,
        has_more: false
      } satisfies ListAssetsResponse
      await route.fulfill({ json: response })
    })
    await use(requests)
  }
})

contractTest.describe(
  'Assets sidebar Asset API contract',
  { tag: '@oss' },
  () => {
    contractTest.use({ initialFeatureFlags: { assets: true } })

    contractTest(
      'uses the shared query contract when enabled on OSS',
      async ({ assetApiRequests, comfyPage }) => {
        await comfyPage.featureFlags.setServerFlagsPersistent({ assets: true })
        const tab = comfyPage.menu.assetsTab
        await tab.open({ waitForAssets: false })
        await expect(tab.getAssetCardByName('enabled-output')).toBeVisible()
        await tab.switchToImported()
        await expect(tab.getAssetCardByName('enabled-input')).toBeVisible()

        const outputRequest = assetApiRequests.find((url) =>
          url.searchParams.get('tags_any')?.includes('output')
        )
        const inputRequest = assetApiRequests.find(
          (url) => url.searchParams.get('include_tags') === 'input'
        )
        expect(outputRequest?.searchParams.get('tags_any')).toBe('output,temp')
        expect(outputRequest?.searchParams.get('tags_none')).toBe('missing')
        expect(inputRequest?.searchParams.get('include_tags')).toBe('input')
        expect(inputRequest?.searchParams.get('tags_none')).toBe('missing')
      }
    )
  }
)

contractTest.describe(
  'Assets sidebar Asset API contract on Cloud',
  { tag: '@cloud' },
  () => {
    contractTest.use({ initialFeatureFlags: { assets: true } })

    contractTest(
      'uses the shared query contract',
      async ({ assetApiRequests, comfyPage }) => {
        const tab = comfyPage.menu.assetsTab
        await tab.open({ waitForAssets: false })
        await expect(tab.getAssetCardByName('enabled-output')).toBeVisible()
        await tab.switchToImported()
        await expect(tab.getAssetCardByName('enabled-input')).toBeVisible()

        const outputRequest = assetApiRequests.find((url) =>
          url.searchParams.get('tags_any')?.includes('output')
        )
        const inputRequest = assetApiRequests.find(
          (url) => url.searchParams.get('include_tags') === 'input'
        )
        expect(outputRequest?.searchParams.get('tags_any')).toBe('output,temp')
        expect(outputRequest?.searchParams.get('tags_none')).toBe('missing')
        expect(inputRequest?.searchParams.get('include_tags')).toBe('input')
        expect(inputRequest?.searchParams.get('tags_none')).toBe('missing')
      }
    )
  }
)

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
        json: { assets: [], total: 0, has_more: false }
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
      test.fail(
        true,
        'Cloud currently enables Assets unconditionally instead of honoring the off flag'
      )

      const assetListRequests: string[] = []
      await page.route(/\/api\/assets(?:\?.*)?$/, async (route) => {
        assetListRequests.push(route.request().url())
        await route.fulfill({
          json: { assets: [], total: 0, has_more: false }
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
