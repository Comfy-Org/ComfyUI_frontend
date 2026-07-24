import { test as base } from '@playwright/test'
import type { Page, Route } from '@playwright/test'

import type { Asset } from '@comfyorg/ingest-types'
import { comfyPageFixture } from '@e2e/fixtures/ComfyPage'
import type { AssetHelper } from '@e2e/fixtures/helpers/AssetHelper'
import { createAssetHelper, withAsset } from '@e2e/fixtures/helpers/AssetHelper'

const ASSETS_ROUTE_PATTERN = /\/api\/assets(?:\?.*)?$/
const cloudAssetRequestsByPage = new WeakMap<Page, string[]>()

export function assetRequestIncludesTag(url: string, tag: string): boolean {
  const includeTags = new URL(url).searchParams.get('include_tags') ?? ''
  return includeTags
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean)
    .includes(tag)
}

export function countAssetRequestsByTag(
  requests: string[],
  tag: string
): number {
  return requests.filter((url) => assetRequestIncludesTag(url, tag)).length
}

export const assetApiFixture = base.extend<{
  assetApi: AssetHelper
}>({
  assetApi: async ({ page }, use) => {
    const assetApi = createAssetHelper(page)

    await use(assetApi)

    await assetApi.clearMocks()
  }
})

export function createCloudAssetsFixture(assets: ReadonlyArray<Asset>) {
  return comfyPageFixture.extend<{
    cloudAssetRequests: string[]
  }>({
    page: async ({ page }, use) => {
      const cloudAssetRequests: string[] = []
      cloudAssetRequestsByPage.set(page, cloudAssetRequests)
      const assetApi = createAssetHelper(page, ...assets.map(withAsset))

      async function trackAssetRequest(route: Route) {
        cloudAssetRequests.push(route.request().url())
        await route.fallback()
      }

      await assetApi.mock()
      await page.route(ASSETS_ROUTE_PATTERN, trackAssetRequest)

      try {
        await use(page)
      } finally {
        await page.unroute(ASSETS_ROUTE_PATTERN, trackAssetRequest)
        await assetApi.clearMocks()
        cloudAssetRequestsByPage.delete(page)
      }
    },
    cloudAssetRequests: async ({ page }, use) => {
      await use(cloudAssetRequestsByPage.get(page) ?? [])
    }
  })
}
