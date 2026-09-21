import { expect } from '@playwright/test'

import { desktopFixture as test } from '@e2e/fixtures/desktopFixture'

test(
  'desktop window drag region spans the tab bar',
  { tag: '@desktop' },
  async ({ comfyPage }) => {
    const tabBar = comfyPage.menu.topbar.workflowTabs.locator(
      '.workflow-tabs-container'
    )
    const dragRegion = tabBar.locator('.window-actions-spacer.app-drag')
    await expect(dragRegion).toBeVisible()
    await expect(dragRegion).toHaveCSS('-webkit-app-region', 'drag')
    const tabBarBox = await tabBar.boundingBox()
    await expect
      .poll(() => dragRegion.boundingBox())
      .toMatchObject({
        y: tabBarBox?.y,
        height: tabBarBox?.height
      })
    await expect
      .poll(async () => (await dragRegion.boundingBox())?.width ?? 0)
      .toBeGreaterThan(0)
  }
)
