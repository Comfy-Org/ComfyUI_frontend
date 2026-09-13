import { expect } from '@playwright/test'

import type { ListAssetsResponse } from '@comfyorg/ingest-types'
import { comfyPageFixture } from '@e2e/fixtures/ComfyPage'
import { generateOutputAssets } from '@e2e/fixtures/data/assetFixtures'

// The sort options live inside the settings popover and only render in cloud
// mode (`MediaAssetFilterBar.vue`: `:show-sort-options="isCloud"`), so these
// are tagged `@cloud`. The sibling `assets-sort.spec.ts` cannot host this
// case: its stub returns every asset in one response with `has_more: false`,
// so there is no paging to keep going. This file serves real pages instead.

const PAGE_SIZE = 8
const ALL_ASSETS = generateOutputAssets(60)
const OLDEST_ID = ALL_ASSETS[0].id
const NEWEST_ID = ALL_ASSETS[ALL_ASSETS.length - 1].id
const TOTAL_PAGES = Math.ceil(ALL_ASSETS.length / PAGE_SIZE)

function pageFor(url: URL): ListAssetsResponse {
  const after = url.searchParams.get('after')
  const start = after
    ? ALL_ASSETS.findIndex((asset) => asset.id === after) + 1
    : Number(url.searchParams.get('offset') ?? '0')
  const end = start + PAGE_SIZE
  const page = ALL_ASSETS.slice(start, end)
  const hasMore = end < ALL_ASSETS.length

  return {
    assets: page,
    total: ALL_ASSETS.length,
    has_more: hasMore,
    next_cursor: hasMore ? page.at(-1)?.id : undefined
  }
}

const test = comfyPageFixture.extend<{
  pagedCloudAssets: URL[]
  stubInputFiles: void
}>({
  // Auto fixtures run before the comfyPage fixture's internal setup(), so the
  // page first-loads with these routes already registered.
  pagedCloudAssets: [
    async ({ page }, use) => {
      const requested: URL[] = []
      const pattern = /\/api\/assets(?:\?.*)?$/
      await page.route(pattern, (route) => {
        const url = new URL(route.request().url())
        requested.push(url)
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(pageFor(url))
        })
      })
      await use(requested)
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

test.describe('Assets sidebar - sort while paging', { tag: '@cloud' }, () => {
  test('Changing sort while scrolled partway down restarts at the top and keeps paging', async ({
    comfyPage,
    pagedCloudAssets
  }) => {
    const tab = comfyPage.menu.assetsTab
    await tab.open()

    const firstRenderedId = () =>
      tab.assetCards.first().getAttribute('data-asset-id')
    const lastRenderedId = () =>
      tab.assetCards.last().getAttribute('data-asset-id')
    const scrollToLastRendered = () =>
      tab.assetCards.last().scrollIntoViewIfNeeded()

    await test.step('Default order puts the newest asset first', async () => {
      await expect.poll(firstRenderedId).toBe(NEWEST_ID)
    })

    await test.step('Scroll far enough that the grid no longer renders the top of the list', async () => {
      await expect
        .poll(
          async () => {
            await scrollToLastRendered()
            return firstRenderedId()
          },
          { timeout: 20_000 }
        )
        .not.toBe(NEWEST_ID)
    })

    // Guards the "keeps paging" assertion below: if scrolling had already
    // exhausted the list, no further request could fire and that assertion
    // would pass for a list that stopped paging entirely.
    const pagesBeforeSort = pagedCloudAssets.length
    expect(pagesBeforeSort).toBeLessThan(TOTAL_PAGES)

    await test.step('Changing the sort order re-sorts from the top', async () => {
      await tab.openSettingsMenu()
      await tab.sortOldestFirst.click()

      // Under "oldest first" the oldest asset heads the list, so seeing it
      // rendered first requires both the new order and a scroll reset — a
      // re-sort that kept the scroll offset would show a mid-list asset.
      await expect.poll(firstRenderedId).toBe(OLDEST_ID)
    })

    await test.step('The re-sorted list continues to page in more items', async () => {
      await expect
        .poll(
          async () => {
            await scrollToLastRendered()
            return lastRenderedId()
          },
          { timeout: 20_000 }
        )
        .toBe(NEWEST_ID)

      expect(pagedCloudAssets.length).toBeGreaterThan(pagesBeforeSort)
    })
  })
})
