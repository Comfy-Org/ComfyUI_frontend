import { expect } from '@playwright/test'

import { comfyPageFixture as test } from '@e2e/fixtures/ComfyPage'
import { createMockJob } from '@e2e/fixtures/helpers/AssetsHelper'
import type { JobDetail } from '@/platform/remote/comfyui/jobs/jobTypes'

/**
 * Expanded folder view must drop output records that resolve to the same
 * composite `${nodeId}-${subfolder}-${filename}` key; otherwise Vue's keyed
 * v-for in VirtualGrid collides and one asset visibly duplicates its
 * neighbours while scrolling.
 */

const STACK_JOB_ID = 'job-output-dedupe'
const COVER_NODE_ID = '9'
const COVER_FILENAME = 'cover_00001_.png'
const DUPLICATE_FILENAME = 'duplicate_00002_.png'
const DISTINCT_FILENAMES = ['distinct_00003_.png', 'distinct_00004_.png']

// 5 records: 1 cover + 2 distinct + 2 sharing DUPLICATE_FILENAME.
// 4 unique composite keys expected after dedupe.
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
  'Expanded folder view dedupes duplicate composite output keys',
  { tag: '@cloud' },
  () => {
    // @cloud comfyPage already navigates with Firebase auth seeded; a second
    // setup() call would clear localStorage and bounce to /cloud/login.
    test.beforeEach(async ({ comfyPage }) => {
      await comfyPage.assets.mockOutputHistory([STACK_JOB])
      await comfyPage.assets.mockInputFiles([])
      await comfyPage.assets.mockJobDetail(STACK_JOB_ID, STACK_JOB_DETAIL)
    })

    test.afterEach(async ({ comfyPage }) => {
      await comfyPage.assets.clearMocks()
    })

    test('renders one tile per unique composite key', async ({
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

      await expect(tab.assetCards).toHaveCount(EXPECTED_TOTAL_TILES)

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
