import { expect } from '@playwright/test'

import type { Asset, ListAssetsResponse } from '@comfyorg/ingest-types'
import { comfyPageFixture } from '@e2e/fixtures/ComfyPage'

// Cloud ingest defaults `include_public` to true, which also returns the
// shared template-input catalog. The mock below returns public assets unless
// the request sends `include_public=false`, so the panel only stays clean
// when the client opts out explicitly (FE-3332, FE-2812).

const createdAt = new Date().toISOString()

function makeAsset(id: string, name: string, tags: string[]): Asset {
  return {
    id,
    name,
    tags,
    preview_url: `/api/view?filename=${name}&type=input`,
    created_at: createdAt,
    updated_at: createdAt
  }
}

const OWN_INPUT = makeAsset('own-input', 'my_upload.png', ['input'])
const OWN_OUTPUT = makeAsset('own-output', 'my_render.png', ['output'])
const PUBLIC_ASSETS = [
  makeAsset('public-template-input-a', 'template_sample_a.png', ['input']),
  makeAsset('public-template-input-b', 'template_sample_b.png', ['input']),
  makeAsset('public-published-output', 'published_render.png', ['output'])
]

function respond(assets: Asset[]): ListAssetsResponse {
  return { assets, total: assets.length, has_more: false }
}

const test = comfyPageFixture.extend<{
  assetListRequests: URL[]
  stubInputFiles: void
}>({
  assetListRequests: [
    async ({ page }, use) => {
      const requests: URL[] = []
      const pattern = /\/api\/assets(?:\?.*)?$/
      await page.route(pattern, (route) => {
        const url = new URL(route.request().url())
        requests.push(url)
        const csv = (key: string) =>
          (url.searchParams.get(key) ?? '').split(',').filter(Boolean)
        const tagsAny = csv('tags_any')
        const tagsNone = csv('tags_none')
        const includePublic = url.searchParams.get('include_public') !== 'false'

        const visible = includePublic
          ? [OWN_INPUT, OWN_OUTPUT, ...PUBLIC_ASSETS]
          : [OWN_INPUT, OWN_OUTPUT]
        const matches = url.searchParams.get('after')
          ? []
          : visible.filter(
              (asset) =>
                tagsAny.some((tag) => asset.tags?.includes(tag)) &&
                !tagsNone.some((tag) => asset.tags?.includes(tag))
            )

        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(respond(matches))
        })
      })
      await use(requests)
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

test.describe(
  'Assets sidebar - public assets stay out of the panel',
  { tag: '@cloud' },
  () => {
    test('Imported tab lists only the user’s own inputs', async ({
      comfyPage,
      assetListRequests
    }) => {
      const tab = comfyPage.menu.assetsTab
      await tab.open()
      await tab.switchToImported()

      await expect(tab.getAssetCardByName('my_upload')).toBeVisible()
      await expect(tab.getAssetCardByName('template_sample_a')).toHaveCount(0)
      await expect(tab.getAssetCardByName('template_sample_b')).toHaveCount(0)
      await expect(tab.assetCards).toHaveCount(1)

      const inputRequests = assetListRequests.filter((url) =>
        url.searchParams.get('tags_any')?.split(',').includes('input')
      )
      expect(inputRequests.length).toBeGreaterThan(0)
      for (const url of inputRequests)
        expect(url.searchParams.get('include_public')).toBe('false')
    })

    test('Generated tab omits published assets of other users', async ({
      comfyPage,
      assetListRequests
    }) => {
      const tab = comfyPage.menu.assetsTab
      await tab.open()

      await expect(tab.getAssetCardByName('my_render')).toBeVisible()
      await expect(tab.getAssetCardByName('published_render')).toHaveCount(0)

      const outputRequests = assetListRequests.filter((url) =>
        url.searchParams.get('tags_any')?.split(',').includes('output')
      )
      expect(outputRequests.length).toBeGreaterThan(0)
      for (const url of outputRequests)
        expect(url.searchParams.get('include_public')).toBe('false')
    })
  }
)
