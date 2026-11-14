import { networkIsolationFixture as base } from '@e2e/fixtures/networkIsolationFixture'
import type { Page, Route } from '@playwright/test'

import type { Asset, ListAssetsResponse } from '@comfyorg/ingest-types'
import { comfyPageFixture } from '@e2e/fixtures/ComfyPage'
import type {
  AssetHelper,
  AssetOperator
} from '@e2e/fixtures/helpers/AssetHelper'
import { createAssetHelper } from '@e2e/fixtures/helpers/AssetHelper'
import { ModelLibraryHelper } from '@e2e/fixtures/helpers/ModelLibraryHelper'
import type { ModelFolderInfo } from '@comfyorg/api-client/types'

const ASSETS_ROUTE_PATTERN = /\/api\/assets(?:\?.*)?$/
const cloudAssetRequestsByPage = new WeakMap<Page, string[]>()

export function makeAssetsResponse(
  url: string,
  allAssets: ReadonlyArray<Asset>
): ListAssetsResponse {
  const hash = new URL(url).searchParams.get('hash')
  const assets =
    hash === null
      ? [...allAssets]
      : allAssets.filter((asset) => asset.hash === hash)
  return { assets, total: assets.length, has_more: false }
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
        const url = route.request().url()
        cloudAssetRequests.push(url)
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(makeAssetsResponse(url, assets))
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

/** Mocks `/api/assets` with public assets included unless `include_public=false`. */
export function createIncludePublicAssetsFixture(
  ownAssets: ReadonlyArray<Asset>,
  publicAssets: ReadonlyArray<Asset>
) {
  return comfyPageFixture.extend<{
    includePublicValues: (tag: string) => Array<string | null>
  }>({
    includePublicValues: [
      async ({ page }, use) => {
        const requests: URL[] = []
        await page.route(ASSETS_ROUTE_PATTERN, (route) => {
          const url = new URL(route.request().url())
          requests.push(url)
          const csv = (key: string) =>
            (url.searchParams.get(key) ?? '').split(',').filter(Boolean)
          const visible =
            url.searchParams.get('include_public') === 'false'
              ? ownAssets
              : [...ownAssets, ...publicAssets]
          const assets = url.searchParams.get('after')
            ? []
            : visible.filter(
                (asset) =>
                  csv('tags_any').some((tag) => asset.tags?.includes(tag)) &&
                  !csv('tags_none').some((tag) => asset.tags?.includes(tag))
              )
          return route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
              assets,
              total: assets.length,
              has_more: false
            } satisfies ListAssetsResponse)
          })
        })
        await page.route(/\/internal\/files\/input(?:\?.*)?$/, (route) =>
          route.fulfill({ status: 200, json: [] })
        )
        await use((tag) =>
          requests
            .filter((url) => assetRequestIncludesTag(url.href, tag))
            .map((url) => url.searchParams.get('include_public'))
        )
      },
      { auto: true }
    ]
  })
}
