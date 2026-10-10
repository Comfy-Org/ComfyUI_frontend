import type { ListAssetsResponse } from '@comfyorg/ingest-types'

import { comfyPageFixture } from '@e2e/fixtures/ComfyPage'
import { generateOutputAssets } from '@e2e/fixtures/data/assetFixtures'

const PAGE_SIZE = 8

/**
 * Served newest-first, the order the backend returns for the default sort.
 * Serving oldest-first makes the default order head at the end of whatever
 * prefix has loaded, so every arriving page is inserted above and the top of
 * the list moves on each fetch.
 *
 * Long enough that filling the initial viewport cannot reach the end — at 60
 * assets the list was exhausted before a test could change the sort, leaving
 * nothing for a paging assertion to observe.
 */
const PAGED_ASSETS_NEWEST_FIRST = generateOutputAssets(400).reverse()

export const NEWEST_PAGED_ASSET_ID = PAGED_ASSETS_NEWEST_FIRST[0].id

/** Position of an asset in the source list, by the id its card carries. */
export function pagedAssetPosition(id: string | null) {
  return PAGED_ASSETS_NEWEST_FIRST.findIndex((asset) => asset.id === id)
}

function pageFor(url: URL): { response: ListAssetsResponse; start: number } {
  const after = url.searchParams.get('after')
  const start = after
    ? PAGED_ASSETS_NEWEST_FIRST.findIndex((asset) => asset.id === after) + 1
    : Number(url.searchParams.get('offset') ?? '0')
  const end = start + PAGE_SIZE
  const page = PAGED_ASSETS_NEWEST_FIRST.slice(start, end)
  const hasMore = end < PAGED_ASSETS_NEWEST_FIRST.length

  return {
    start,
    response: {
      assets: page,
      total: PAGED_ASSETS_NEWEST_FIRST.length,
      has_more: hasMore,
      next_cursor: hasMore ? page.at(-1)?.id : undefined
    }
  }
}

export interface PagedAssets {
  /**
   * How deep into the list the backend has been asked to go, as the largest
   * start offset served so far, or -1 before any response.
   *
   * Deliberately not a request count: filling the initial viewport takes
   * several requests and the sidebar queries `/api/assets` for more than the
   * generated list, so a count says nothing about how much has been paged in.
   */
  furthestServed(): number
  /** Assets remain beyond the furthest page served. */
  canPageFurther(): boolean
}

/**
 * Serves `/api/assets` as real pages, and stubs input files as empty.
 *
 * Both routes are auto fixtures because Playwright runs those before the
 * `comfyPage` fixture's internal `setup()`, so the page first-loads with the
 * mocks already in place.
 */
export const pagedAssetsFixture = comfyPageFixture.extend<{
  pagedAssets: PagedAssets
  stubInputFiles: void
}>({
  pagedAssets: [
    async ({ page }, use) => {
      const starts: number[] = []
      const pattern = /\/api\/assets(?:\?.*)?$/

      await page.route(pattern, (route) => {
        const { response, start } = pageFor(new URL(route.request().url()))
        starts.push(start)
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(response)
        })
      })

      const furthestServed = () => Math.max(-1, ...starts)

      await use({
        furthestServed,
        canPageFurther: () =>
          furthestServed() + PAGE_SIZE < PAGED_ASSETS_NEWEST_FIRST.length
      })

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
