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
    // The @cloud comfyPage fixture already navigates with Firebase auth
    // seeded; a second comfyPage.setup() here clears localStorage and
    // bounces the page to /cloud/login, so we only register the per-test
    // route mocks (they still intercept the lazy fetches issued when the
    // sidebar opens in the test body).
    test.beforeEach(async ({ comfyPage }) => {
      await comfyPage.assets.mockOutputHistory([STACK_JOB])
      await comfyPage.assets.mockInputFiles([])
      await comfyPage.assets.mockJobDetail(STACK_JOB_ID, STACK_JOB_DETAIL)
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

      // The 5-output stack contains two records colliding on the composite
      // output key. After dedupe, exactly 4 cards render. Without the fix,
      // `items.length` stays at 5 and so does the rendered tile count, so
      // a direct card count discriminates red/green.
      await expect(tab.assetCards).toHaveCount(EXPECTED_TOTAL_TILES)

      // Defence-in-depth: every rendered card must carry a unique aria-label,
      // catching residual key-collision-driven DOM reuse if it ever resurfaces.
      // MediaAssetCard sets `aria-label="<filename> image asset"` on the card
      // root, which is the element matched by `tab.assetCards`.
      const labels = await tab.assetCards.evaluateAll((nodes) =>
        nodes
          .map((el) => el.getAttribute('aria-label'))
          .filter((v): v is string => v !== null)
      )
      expect(new Set(labels).size).toBe(labels.length)

      await testInfo.attach('expanded-folder-view.png', {
        body: await comfyPage.page.screenshot({ fullPage: false }),
        contentType: 'image/png'
      })
    })
  }
)
