import { expect } from '@playwright/test'

import { comfyPageFixture as test } from '@e2e/fixtures/ComfyPage'

const MIN_TOUCH_WIDTH = 120
const MIN_TOUCH_HEIGHT = 44

test.describe(
  'Workflow Tabs on mobile',
  { tag: ['@mobile', '@workflow'] },
  () => {
    test.beforeEach(async ({ comfyPage }) => {
      await comfyPage.settings.setSetting(
        'Comfy.Workflow.WorkflowTabsPosition',
        'Topbar'
      )
      await comfyPage.setup()
    })

    test('@mobile enlarges tab touch targets instead of squishing them', async ({
      comfyPage
    }) => {
      await comfyPage.menu.topbar.triggerTopbarCommand(['New'])
      await comfyPage.menu.topbar.triggerTopbarCommand(['New'])

      const tabs = comfyPage.page.locator('.workflow-tabs .p-togglebutton')
      await expect(tabs).not.toHaveCount(0)

      const count = await tabs.count()
      for (let i = 0; i < count; i++) {
        const box = await tabs.nth(i).boundingBox()
        expect(box).not.toBeNull()
        expect(box!.width).toBeGreaterThanOrEqual(MIN_TOUCH_WIDTH)
        expect(box!.height).toBeGreaterThanOrEqual(MIN_TOUCH_HEIGHT)
      }
    })

    test('@mobile keeps the horizontal strip with overflow scrolling', async ({
      comfyPage
    }) => {
      for (let i = 0; i < 4; i++) {
        await comfyPage.menu.topbar.triggerTopbarCommand(['New'])
      }

      const strip = comfyPage.page.getByTestId('topbar-workflow-tabs')
      await expect(strip).toBeVisible()

      const scrollContent = comfyPage.page.locator('.p-scrollpanel-content')
      await expect
        .poll(() =>
          scrollContent.evaluate((el) => el.scrollWidth > el.clientWidth)
        )
        .toBe(true)
    })
  }
)
