import { expect } from '@playwright/test'

import { comfyPageFixture as test } from '@e2e/fixtures/ComfyPage'

test(
  'Sidebar close button closes the panel and clears its sidebar icon',
  { tag: '@screenshot' },
  async ({ comfyPage }) => {
    const tab = comfyPage.menu.workflowsTab
    await tab.open()
    await expect(tab.selectedTabButton).toBeVisible()

    await comfyPage.page.mouse.move(0, 0)
    await expect(tab.panelHeader).toHaveScreenshot(
      'workflows-sidebar-header.png'
    )

    await tab.closeButton.click()

    await expect(tab.closeButton).toBeHidden()
    await expect(tab.selectedTabButton).toBeHidden()
  }
)
