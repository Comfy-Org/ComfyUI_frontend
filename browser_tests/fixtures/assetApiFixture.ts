import { test as base } from '@playwright/test'
import type { Page, Route } from '@playwright/test'

import type { Asset, ListAssetsResponse } from '@comfyorg/ingest-types'
import { comfyPageFixture } from '@e2e/fixtures/ComfyPage'
import type { AssetHelper } from '@e2e/fixtures/helpers/AssetHelper'
import { createAssetHelper } from '@e2e/fixtures/helpers/AssetHelper'

const ASSETS_ROUTE_PATTERN = /\/api\/assets(?:\?.*)?$/
const cloudAssetRequestsByPage = new WeakMap<Page, string[]>()

function makeAssetsResponse(assets: ReadonlyArray<Asset>): ListAssetsResponse {
  return { assets: [...assets], total: assets.length, has_more: false }
}

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

      async function assetsRouteHandler(route: Route) {
        cloudAssetRequests.push(route.request().url())
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(makeAssetsResponse(assets))
        })
      }

      await page.route(ASSETS_ROUTE_PATTERN, assetsRouteHandler)
      await use(page)
      await page.unroute(ASSETS_ROUTE_PATTERN, assetsRouteHandler)
      cloudAssetRequestsByPage.delete(page)
    },
    cloudAssetRequests: async ({ page }, use) => {
      await use(cloudAssetRequestsByPage.get(page) ?? [])
    }
  })
}
