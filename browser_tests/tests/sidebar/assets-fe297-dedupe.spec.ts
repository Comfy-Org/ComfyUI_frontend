import { expect } from '@playwright/test'

import { comfyPageFixture as test } from '@e2e/fixtures/ComfyPage'
import { createMockJob } from '@e2e/fixtures/helpers/AssetsHelper'
import type { JobDetail } from '@/platform/remote/comfyui/jobs/jobTypes'

/**
 * FE-297 — when the cloud `getJobDetail` returns two output records that
 * resolve to the same composite `${nodeId}-${subfolder}-${filename}` key,
 * `mapOutputsToAssetItems` produces two AssetItems with the same id, the
 * keyed v-for in `VirtualGrid` collides, and the user sees one asset
 * visibly duplicate and progressively replace its neighbours while
 * scrolling through the expanded folder view of a large job.
 *
 * The data layer must drop subsequent records that collide on the
 * composite key so each rendered tile keeps a unique id.
 */

const STACK_JOB_ID = 'job-fe297'
const COVER_NODE_ID = '9'
const COVER_FILENAME = 'cover_00001_.png'
const DUPLICATE_FILENAME = 'duplicate_00002_.png'
const DISTINCT_FILENAMES = ['distinct_00003_.png', 'distinct_00004_.png']

// 1 cover + 2 distinct + 2 duplicates of DUPLICATE_FILENAME = 5 records,
// chosen to fit the default test viewport without scrolling so the
// assertion does not depend on VirtualGrid scroll virtualization.
// Green: 4 unique composite keys (1 dup dropped).
// Red:   5 records, but two collide on the same composite key — Vue's
//        keyed v-for reuses one DOM node, so the rendered tile count is
//        4 with one tile visibly duplicated, NOT 5.
const STACK_JOB_OUTPUTS = [
  { filename: COVER_FILENAME, subfolder: '', type: 'output' as const },
  ...DISTINCT_FILENAMES.map((filename) => ({
    filename,
    subfolder: '',
    type: 'output' as const
  })),
  { filename: DUPLICATE_FILENAME, subfolder: '', type: 'output' as const },
  { filename: DUPLICATE_FILENAME, subfolder: '', type: 'output' as const }
]

const STACK_JOB = createMockJob({
  id: STACK_JOB_ID,
  create_time: 5000,
  execution_start_time: 5000,
  execution_end_time: 5050,
  preview_output: {
    filename: COVER_FILENAME,
    subfolder: '',
    type: 'output',
    nodeId: COVER_NODE_ID,
    mediaType: 'images'
  },
  outputs_count: STACK_JOB_OUTPUTS.length
})

const STACK_JOB_DETAIL: JobDetail = {
  ...STACK_JOB,
  outputs: {
    [COVER_NODE_ID]: { images: STACK_JOB_OUTPUTS }
  }
}

const EXPECTED_TOTAL_TILES = 4

test.describe(
  'FE-297: media asset panel scroll-duplication',
  { tag: '@cloud' },
  () => {
    test.beforeEach(async ({ comfyPage }) => {
      await comfyPage.assets.mockOutputHistory([STACK_JOB])
      await comfyPage.assets.mockInputFiles([])
      await comfyPage.assets.mockJobDetail(STACK_JOB_ID, STACK_JOB_DETAIL)
      await comfyPage.setup()
    })

    test.afterEach(async ({ comfyPage }) => {
      await comfyPage.assets.clearMocks()
    })

    test('expanded folder view drops duplicate composite keys', async ({
      comfyPage
    }, testInfo) => {
      const tab = comfyPage.menu.assetsTab
      await tab.open()
      await tab.waitForAssets()

      await tab.assetCards
        .first()
        .getByRole('button', { name: 'See more outputs' })
        .click()
      await expect(tab.backToAssetsButton).toBeVisible()
      await expect(tab.assetCards.first()).toBeVisible()

      // The fix dedupes outputs that share a composite output key BEFORE
      // they reach `<VirtualGrid items :key="item.key">`. Each AssetItem
      // becomes one `data-virtual-grid-item` row in the rendered slice,
      // and the topSpacer/bottomSpacer heights together encode the total
      // `items.length` because the grid lays rows out at a fixed height.
      // Counting total rows from spacers + rendered count is independent
      // of viewport height and Vue's same-key DOM reuse.
      const totals = await comfyPage.page.evaluate(() => {
        const scroller = document.querySelector(
          '.sidebar-content-container [class*="overflow-y-auto"]'
        ) as HTMLElement | null
        if (!scroller) return null
        const items = scroller.querySelectorAll('[data-virtual-grid-item]')
        const sample = items[0] as HTMLElement | undefined
        if (!sample) {
          return { totalRows: 0, renderedRows: 0, labels: [] as string[] }
        }
        const rowHeight = sample.getBoundingClientRect().height || 200
        const spacers = scroller.querySelectorAll(
          ':scope > div:not([style*="display: grid"])'
        )
        let spacerHeight = 0
        for (const s of Array.from(spacers)) {
          const h = (s as HTMLElement).getBoundingClientRect().height
          spacerHeight += h
        }
        const totalRows = Math.round(
          (spacerHeight + items.length * rowHeight) / rowHeight
        )
        const labels = Array.from(items)
          .map(
            (el) =>
              el
                .querySelector('[aria-label$="image asset"]')
                ?.getAttribute('aria-label') ?? null
          )
          .filter((v): v is string => v !== null)
        return { totalRows, renderedRows: items.length, labels }
      })

      expect(totals).not.toBeNull()
      expect(totals!.totalRows).toBe(EXPECTED_TOTAL_TILES)
      // Defence-in-depth: every rendered row must carry a unique label
      expect(new Set(totals!.labels).size).toBe(totals!.labels.length)

      await testInfo.attach('expanded-folder-view.png', {
        body: await comfyPage.page.screenshot({ fullPage: false }),
        contentType: 'image/png'
      })
    })
  }
)
