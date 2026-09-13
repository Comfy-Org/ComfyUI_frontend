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

// Served newest-first, the order a real backend returns for the default sort.
// Serving them oldest-first instead makes the default "newest first" order head
// at the end of whatever prefix has loaded, so the top of the list changes
// every time another page arrives and nothing about scroll position is stable.
const ASSETS_NEWEST_FIRST = generateOutputAssets(60).reverse()
const NEWEST_ID = ASSETS_NEWEST_FIRST[0].id
const TOTAL_PAGES = Math.ceil(ASSETS_NEWEST_FIRST.length / PAGE_SIZE)

function pageFor(url: URL): ListAssetsResponse {
  const after = url.searchParams.get('after')
  const start = after
    ? ASSETS_NEWEST_FIRST.findIndex((asset) => asset.id === after) + 1
    : Number(url.searchParams.get('offset') ?? '0')
  const end = start + PAGE_SIZE
  const page = ASSETS_NEWEST_FIRST.slice(start, end)
  const hasMore = end < ASSETS_NEWEST_FIRST.length

  return {
    assets: page,
    total: ASSETS_NEWEST_FIRST.length,
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

    // VirtualGrid's scroller carries no test id, so find it from a rendered
    // card: the nearest ancestor that actually overflows.
    const scrollOffset = () =>
      tab.assetCards.first().evaluate((card) => {
        let node = card.parentElement
        while (node && node.scrollHeight <= node.clientHeight) {
          node = node.parentElement
        }
        return node?.scrollTop ?? -1
      })

    const scrollToLastRendered = () =>
      tab.assetCards.last().scrollIntoViewIfNeeded()

    await test.step('Default order heads with the newest asset', async () => {
      await expect.poll(firstRenderedId).toBe(NEWEST_ID)
      expect(await scrollOffset()).toBe(0)
    })

    await test.step('Scroll down until the grid no longer renders the top of the list', async () => {
      await expect
        .poll(
          async () => {
            await scrollToLastRendered()
            return firstRenderedId()
          },
          { timeout: 20_000 }
        )
        .not.toBe(NEWEST_ID)

      // Without this the scroll-reset assertion below would pass for a list
      // that never left the top.
      expect(await scrollOffset()).toBeGreaterThan(0)
    })

    // Guards the "keeps paging" assertion: if scrolling had already exhausted
    // the list, no further request could fire and that assertion would pass
    // for a list that stopped paging entirely.
    const pagesBeforeSort = pagedCloudAssets.length
    expect(pagesBeforeSort).toBeLessThan(TOTAL_PAGES)

    await test.step('Changing the sort order restarts the list at the top', async () => {
      await tab.openSettingsMenu()
      await tab.sortOldestFirst.click()

      await expect.poll(scrollOffset).toBe(0)

      // The scroll reset alone would leave the newest asset at the head, so
      // this is what distinguishes a re-sort from a bare scroll-to-top.
      await expect.poll(firstRenderedId).not.toBe(NEWEST_ID)
    })

    await test.step('The re-sorted list continues to page in more items', async () => {
      await expect
        .poll(
          async () => {
            await scrollToLastRendered()
            return pagedCloudAssets.length
          },
          { timeout: 20_000 }
        )
        .toBeGreaterThan(pagesBeforeSort)
    })
  })
})
