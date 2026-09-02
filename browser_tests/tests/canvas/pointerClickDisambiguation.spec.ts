import {
  comfyExpect as expect,
  comfyPageFixture as test
} from '@e2e/fixtures/ComfyPage'

test.describe(
  'Canvas pointer click and drag disambiguation',
  { tag: ['@canvas', '@node'] },
  () => {
    test.beforeEach(async ({ comfyPage }) => {
      // The gesture under test is the drift, not the interval. Playwright's
      // per-action delay (SLOW_MO=1000 in the video-recording job) lands
      // between the two presses, so the default 300ms would unpair them.
      await comfyPage.settings.setSetting(
        'Comfy.Pointer.DoubleClickTime',
        10000
      )
    })

    test('opens node search on a double click that drifts within the click threshold', async ({
      comfyPage
    }) => {
      await comfyPage.canvasOps.doubleClickWithDrift({ x: 200, y: 200 })

      await expect(comfyPage.searchBoxV2.dialog).toBeVisible()
    })
  }
)
