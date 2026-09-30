import { expect } from '@playwright/test'
import type { Locator } from '@playwright/test'

import type { Asset, ListAssetsResponse } from '@comfyorg/ingest-types'
import { comfyPageFixture } from '@e2e/fixtures/ComfyPage'

// The assets sidebar's sort options live inside the settings popover and are
// only rendered when the assets API is enabled (always true in cloud). We tag
// tests `@cloud` so they run against the cloud Playwright project, and
// register `/api/assets` and `/internal/files/input` route handlers as auto
// fixtures — Playwright runs auto fixtures before the `comfyPage` fixture's
// internal `setup()`, so the page first-loads with mocks already in place.
// Sorting is server-side, so the `/api/assets` mock honors `sort` and `order`.

// Three jobs whose name and create_time axes are intentionally misaligned so
// all four sorts produce different orderings.
//
//   job       name      created_at (ms)
//   ----------------------------------
//   job-001   apple          1000
//   job-002   Zebra          2000
//   job-003   Banana         3000

const JOB_UUIDS: Record<string, string> = {
  'job-001': '00000000-0000-4000-a000-000000000001',
  'job-002': '00000000-0000-4000-a000-000000000002',
  'job-003': '00000000-0000-4000-a000-000000000003'
}

interface JobSpec {
  id: string
  filename: string
  createTime: number
}

const SPECS: JobSpec[] = [
  { id: 'job-001', filename: 'apple.png', createTime: 1000 },
  { id: 'job-002', filename: 'Zebra.png', createTime: 2000 },
  { id: 'job-003', filename: 'Banana.png', createTime: 3000 }
]

// 2 assets per job so outputCount > 1 and "See more outputs" renders.
// The primary asset (with the expected filename) is created 1ms after the
// extra so byCreatedAtAsc puts it last and findLast picks it as
// the representative in unflattenOutputAssets.
const CLOUD_ASSETS: Asset[] = SPECS.flatMap((spec) => {
  const jobId = JOB_UUIDS[spec.id]
  return [
    {
      id: `${spec.id}-asset-1`,
      name: `${spec.id}_extra.png`,
      job_id: jobId,
      mime_type: 'image/png',
      tags: ['output'],
      preview_url: `/api/view?filename=${spec.id}_extra.png&type=output`,
      created_at: new Date(spec.createTime).toISOString(),
      updated_at: new Date(spec.createTime).toISOString()
    },
    {
      id: `${spec.id}-asset-0`,
      name: spec.filename,
      job_id: jobId,
      mime_type: 'image/png',
      tags: ['output'],
      preview_url: `/api/view?filename=${spec.filename}&type=output`,
      created_at: new Date(spec.createTime + 1).toISOString(),
      updated_at: new Date(spec.createTime + 1).toISOString()
    }
  ]
})

// MediaAssetCard renders the filename *without* extension via
// getFilenameDetails(...).filename, so card-text matching uses the basename.
const NAME_BY_ID: Record<string, string> = {
  'job-001': 'apple',
  'job-002': 'Zebra',
  'job-003': 'Banana'
}

async function expectAssetOrder(items: Locator, jobIds: string[]) {
  for (const [index, jobId] of jobIds.entries()) {
    await expect(items.nth(index)).toContainText(NAME_BY_ID[jobId])
  }
}

function makeAssetsResponse(url: URL): ListAssetsResponse {
  const sort = url.searchParams.get('sort')
  const direction = url.searchParams.get('order') === 'asc' ? 1 : -1
  const assets = CLOUD_ASSETS.toSorted(
    (a, b) =>
      direction *
      (sort === 'name'
        ? a.name.localeCompare(b.name, undefined, { sensitivity: 'base' })
        : Date.parse(a.created_at) - Date.parse(b.created_at))
  )
  return { assets, total: assets.length, has_more: false }
}

const test = comfyPageFixture.extend<{
  stubCloudAssets: void
  stubInputFiles: void
}>({
  stubCloudAssets: [
    async ({ page }, use) => {
      const pattern = /\/api\/assets(?:\?.*)?$/
      await page.route(pattern, (route) =>
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(
            makeAssetsResponse(new URL(route.request().url()))
          )
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
    await tab.waitForAssets(SPECS.length)

    await tab.openSettingsMenu()

    await expect(tab.sortNewestFirst).toBeVisible()
    await expect(tab.sortOldestFirst).toBeVisible()
    await expect(tab.sortAToZ).toBeVisible()
    await expect(tab.sortZToA).toBeVisible()
  })

  test('Default order is newest first (descending create_time)', async ({
    comfyPage
  }) => {
    const tab = comfyPage.menu.assetsTab
    await tab.open()
    await tab.waitForAssets(SPECS.length)

    // Cards should appear in the order: job-003, job-002, job-001
    await expect(tab.assetCards.nth(0)).toContainText(NAME_BY_ID['job-003'])
    await expect(tab.assetCards.nth(1)).toContainText(NAME_BY_ID['job-002'])
    await expect(tab.assetCards.nth(2)).toContainText(NAME_BY_ID['job-001'])
  })

  test('"Oldest first" reverses the order', async ({ comfyPage }) => {
    const tab = comfyPage.menu.assetsTab
    await tab.open()
    await tab.waitForAssets(SPECS.length)

    await tab.openSettingsMenu()
    await tab.sortOldestFirst.click()

    await expect(tab.assetCards.nth(0)).toContainText(NAME_BY_ID['job-001'])
    await expect(tab.assetCards.nth(1)).toContainText(NAME_BY_ID['job-002'])
    await expect(tab.assetCards.nth(2)).toContainText(NAME_BY_ID['job-003'])
  })

  test('Name sorting orders output stacks in both grid and list views', async ({
    comfyPage
  }) => {
    const tab = comfyPage.menu.assetsTab
    await tab.open()
    await tab.waitForAssets(SPECS.length)
    await expect(
      comfyPage.page.getByRole('button', { name: 'See more outputs' })
    ).toHaveCount(SPECS.length)

    await tab.openSettingsMenu()
    await tab.sortAToZ.click()
    await expectAssetOrder(tab.assetCards, ['job-001', 'job-003', 'job-002'])

    await tab.listViewOption.click()
    await expect(tab.listViewItems).toHaveCount(SPECS.length)
    await expectAssetOrder(tab.listViewItems, ['job-001', 'job-003', 'job-002'])

    await tab.sortZToA.click()
    await expectAssetOrder(tab.listViewItems, ['job-002', 'job-003', 'job-001'])

    await tab.gridLargeOption.click()
    await expectAssetOrder(tab.assetCards, ['job-002', 'job-003', 'job-001'])
  })

  test('Sort persists when the search input is edited', async ({
    comfyPage
  }) => {
    const tab = comfyPage.menu.assetsTab
    await tab.open()
    await tab.waitForAssets(SPECS.length)

    await tab.openSettingsMenu()
    await tab.sortOldestFirst.click()

    // Type a query that matches all three jobs, then clear it; sort order
    // must remain "oldest first".
    await tab.searchInput.fill('png')
    await tab.searchInput.fill('')

    await expect(tab.assetCards.nth(0)).toContainText(NAME_BY_ID['job-001'])
    await expect(tab.assetCards.nth(2)).toContainText(NAME_BY_ID['job-003'])
  })
})
