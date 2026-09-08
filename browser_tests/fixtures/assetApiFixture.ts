import { test as base } from '@playwright/test'
import type { Page, Route } from '@playwright/test'

import type { Asset, ListAssetsResponse } from '@comfyorg/ingest-types'
import { comfyPageFixture } from '@e2e/fixtures/ComfyPage'
import type {
  AssetHelper,
  AssetOperator
} from '@e2e/fixtures/helpers/AssetHelper'
import { createAssetHelper } from '@e2e/fixtures/helpers/AssetHelper'
import { ModelLibraryHelper } from '@e2e/fixtures/helpers/ModelLibraryHelper'
import type { ModelFolderInfo } from '@/platform/assets/schemas/assetSchema'

const ASSETS_ROUTE_PATTERN = /\/api\/assets(?:\?.*)?$/
const cloudAssetRequestsByPage = new WeakMap<Page, string[]>()

function makeAssetsResponse(assets: ReadonlyArray<Asset>): ListAssetsResponse {
  return { assets: [...assets], total: assets.length, has_more: false }
}

export function assetRequestIncludesTag(url: string, tag: string): boolean {
  const params = new URL(url).searchParams
  return [params.get('include_tags'), params.get('tags_any')]
    .flatMap((value) => (value ?? '').split(','))
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

type ModelLibraryOptions = {
  folders?: ModelFolderInfo[]
  operators?: AssetOperator[]
}

export const assetApiFixture = base.extend<{
  modelLibraryOptions: ModelLibraryOptions
  assetApi: AssetHelper
}>({
  modelLibraryOptions: [{}, { option: true }],
  assetApi: async ({ page, modelLibraryOptions }, use) => {
    const { folders, operators } = modelLibraryOptions
    const assetApi = createAssetHelper(page)

    if (operators) {
      assetApi.configure(...operators)
      await assetApi.mock()
    }
    if (folders) await new ModelLibraryHelper(page).mockModelFolders(folders)

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
