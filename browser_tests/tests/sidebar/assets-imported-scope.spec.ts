import { expect } from '@playwright/test'

import type { Asset, ListAssetsResponse } from '@comfyorg/ingest-types'
import { comfyPageFixture } from '@e2e/fixtures/ComfyPage'

// Regression cover for the Imported tab listing workflow-template inputs that
// belong to the shared public-assets account (FE-2812).
//
// Ingest's GET /api/assets defaults `include_public` to true, and that account
// is cross-workspace by design, so a caller that omits the parameter receives
// the template corpus on top of its own uploads. The route handler below
// models that default and the `tags_any` filter, which is all the panel
// query exercises; an Imported query that stops sending
// `include_public=false` fails this spec.
//
// Tagged @cloud because the asset-backed panel only runs where
// `flags.assetsEnabled` is on.

const PUBLIC_TEMPLATE_INPUT = 'drinking_unicorn'
const OWNED_INPUT = 'my_reference_photo'
const OWNED_OUTPUT = 'my_generation'

function asset(name: string, tags: string[], isPublic: boolean): Asset {
  const createdAt = new Date('2026-01-01T00:00:00Z').toISOString()
  return {
    id: `${name}-id`,
    name: `${name}.png`,
    tags,
    is_immutable: isPublic,
    preview_url: `/api/view?filename=${name}.png`,
    created_at: createdAt,
    updated_at: createdAt
  }
}

const PUBLIC_ASSETS: Asset[] = [asset(PUBLIC_TEMPLATE_INPUT, ['input'], true)]
const OWNED_ASSETS: Asset[] = [
  asset(OWNED_INPUT, ['input'], false),
  asset(OWNED_OUTPUT, ['output'], false)
]

function listResponse(assets: Asset[]): ListAssetsResponse {
  return { assets, total: assets.length, has_more: false }
}

const test = comfyPageFixture.extend<{
  stubScopedAssets: void
  stubInputFiles: void
}>({
  stubScopedAssets: [
    async ({ page }, use) => {
      const pattern = /\/api\/assets(?:\?.*)?$/
      await page.route(pattern, (route) => {
        const url = new URL(route.request().url())
        const tagsAny = (url.searchParams.get('tags_any') ?? '')
          .split(',')
          .filter(Boolean)
        // Absent parameter means "include public", matching the server default.
        const includePublic = url.searchParams.get('include_public') !== 'false'

        const visible = includePublic
          ? [...PUBLIC_ASSETS, ...OWNED_ASSETS]
          : OWNED_ASSETS
        const matches = url.searchParams.get('after')
          ? []
          : visible.filter((candidate) =>
              tagsAny.some((tag) => candidate.tags?.includes(tag))
            )

        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(listResponse(matches))
        })
      })
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

test.describe('Assets sidebar - ownership scope', { tag: '@cloud' }, () => {
  test("Imported tab lists the user's uploads without public template inputs", async ({
    comfyPage
  }) => {
    const tab = comfyPage.menu.assetsTab
    await tab.open()
    await tab.switchToImported()

    await expect(tab.getAssetCardByName(OWNED_INPUT)).toBeVisible()
    await expect(tab.getAssetCardByName(PUBLIC_TEMPLATE_INPUT)).toHaveCount(0)
    await expect(tab.assetCards).toHaveCount(1)
  })
})
