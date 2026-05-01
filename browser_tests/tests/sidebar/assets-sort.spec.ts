import { expect } from '@playwright/test'

import type {
  Asset,
  JobsListResponse,
  ListAssetsResponse
} from '@comfyorg/ingest-types'
import { comfyPageFixture } from '@e2e/fixtures/ComfyPage'
import { createJobsWithExecutionTimes } from '@e2e/fixtures/helpers/AssetsHelper'

// The assets sidebar's sort options live inside the settings popover and are
// only rendered in cloud mode (`MediaAssetFilterBar.vue`:
// `:show-sort-options="isCloud"`). We tag tests `@cloud` so they run against
// the cloud Playwright project, and register `/api/assets`, `/api/jobs`, and
// `/internal/files/input` route handlers as auto fixtures — Playwright runs
// auto fixtures before the `comfyPage` fixture's internal `setup()`, so the
// page first-loads with mocks already in place.

// Three jobs whose `(create_time, duration)` axes are intentionally
// misaligned so newest/oldest and longest/fastest sorts produce *different*
// orderings — preventing false-pass tests where one ordering accidentally
// satisfies another.
//
//   spec      create_time    duration (ms)
//   ----------------------------------------
//   job-001       1000             5000      (oldest, mid duration)
//   job-002       2000            10000      (mid age, longest)
//   job-003       3000             3000      (newest, shortest)
const SORT_JOBS = createJobsWithExecutionTimes([
  { createTime: 1000, durationMs: 5000 },
  { createTime: 2000, durationMs: 10000 },
  { createTime: 3000, durationMs: 3000 }
])

// MediaAssetCard renders the filename *without* extension via
// getFilenameDetails(...).filename, so card-text matching uses the basename.
const NAME_BY_ID: Record<string, string> = {
  'job-001': 'output_job-001',
  'job-002': 'output_job-002',
  'job-003': 'output_job-003'
}

function makeAssetsResponse(assets: Asset[]): ListAssetsResponse {
  return { assets, total: assets.length, has_more: false }
}

function makeJobsResponseBody() {
  return {
    jobs: SORT_JOBS,
    pagination: {
      offset: 0,
      limit: SORT_JOBS.length,
      total: SORT_JOBS.length,
      has_more: false
    }
  } satisfies {
    jobs: unknown[]
    pagination: JobsListResponse['pagination']
  }
}

const test = comfyPageFixture.extend<{
  stubCloudAssets: void
  stubJobs: void
  stubInputFiles: void
}>({
  stubCloudAssets: [
    async ({ page }, use) => {
      const pattern = '**/api/assets?*'
      await page.route(pattern, (route) =>
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(makeAssetsResponse([]))
        })
      )
      await use()
      await page.unroute(pattern)
    },
    { auto: true }
  ],
  stubJobs: [
    async ({ page }, use) => {
      const pattern = /\/api\/jobs(?:\?.*)?$/
      await page.route(pattern, (route) =>
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(makeJobsResponseBody())
        })
      )
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

test.describe('Assets sidebar - sort options', { tag: '@cloud' }, () => {
  test('Settings menu exposes all four sort options in cloud mode', async ({
    comfyPage
  }) => {
    const tab = comfyPage.menu.assetsTab
    await tab.open()
    await tab.waitForAssets(SORT_JOBS.length)

    await tab.openSettingsMenu()

    await expect(tab.sortNewestFirst).toBeVisible()
    await expect(tab.sortOldestFirst).toBeVisible()
    await expect(tab.sortLongestFirst).toBeVisible()
    await expect(tab.sortFastestFirst).toBeVisible()
  })

  test('Default order is newest first (descending create_time)', async ({
    comfyPage
  }) => {
    const tab = comfyPage.menu.assetsTab
    await tab.open()
    await tab.waitForAssets(SORT_JOBS.length)

    // Cards should appear in the order: job-003, job-002, job-001
    await expect(tab.assetCards.nth(0)).toContainText(NAME_BY_ID['job-003'])
    await expect(tab.assetCards.nth(1)).toContainText(NAME_BY_ID['job-002'])
    await expect(tab.assetCards.nth(2)).toContainText(NAME_BY_ID['job-001'])
  })

  test('"Oldest first" reverses the order', async ({ comfyPage }) => {
    const tab = comfyPage.menu.assetsTab
    await tab.open()
    await tab.waitForAssets(SORT_JOBS.length)

    await tab.openSettingsMenu()
    await tab.sortOldestFirst.click()

    await expect(tab.assetCards.nth(0)).toContainText(NAME_BY_ID['job-001'])
    await expect(tab.assetCards.nth(1)).toContainText(NAME_BY_ID['job-002'])
    await expect(tab.assetCards.nth(2)).toContainText(NAME_BY_ID['job-003'])
  })

  test('"Longest first" puts the slowest job at the top', async ({
    comfyPage
  }) => {
    const tab = comfyPage.menu.assetsTab
    await tab.open()
    await tab.waitForAssets(SORT_JOBS.length)

    await tab.openSettingsMenu()
    await tab.sortLongestFirst.click()

    // Expected: job-002 (10s), job-001 (5s), job-003 (3s)
    await expect(tab.assetCards.nth(0)).toContainText(NAME_BY_ID['job-002'])
    await expect(tab.assetCards.nth(1)).toContainText(NAME_BY_ID['job-001'])
    await expect(tab.assetCards.nth(2)).toContainText(NAME_BY_ID['job-003'])
  })

  test('"Fastest first" puts the quickest job at the top', async ({
    comfyPage
  }) => {
    const tab = comfyPage.menu.assetsTab
    await tab.open()
    await tab.waitForAssets(SORT_JOBS.length)

    await tab.openSettingsMenu()
    await tab.sortFastestFirst.click()

    // Expected: job-003 (3s), job-001 (5s), job-002 (10s)
    await expect(tab.assetCards.nth(0)).toContainText(NAME_BY_ID['job-003'])
    await expect(tab.assetCards.nth(1)).toContainText(NAME_BY_ID['job-001'])
    await expect(tab.assetCards.nth(2)).toContainText(NAME_BY_ID['job-002'])
  })

  test('Sort persists when the search input is edited', async ({
    comfyPage
  }) => {
    const tab = comfyPage.menu.assetsTab
    await tab.open()
    await tab.waitForAssets(SORT_JOBS.length)

    await tab.openSettingsMenu()
    await tab.sortOldestFirst.click()

    // Type a query that matches all three jobs, then clear it; sort order
    // must remain "oldest first".
    await tab.searchInput.fill('output_job')
    await tab.searchInput.fill('')

    await expect(tab.assetCards.nth(0)).toContainText(NAME_BY_ID['job-001'])
    await expect(tab.assetCards.nth(2)).toContainText(NAME_BY_ID['job-003'])
  })
})
