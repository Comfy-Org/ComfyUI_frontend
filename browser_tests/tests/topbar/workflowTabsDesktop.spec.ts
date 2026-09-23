import { desktopFixture as test } from '@e2e/fixtures/desktopFixture'
import { expect } from '@playwright/test'

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
    await expect(async () => {
      const [tabBarBox, dragRegionBox] = await Promise.all([
        tabBar.boundingBox(),
        dragRegion.boundingBox()
      ])
      expect(tabBarBox).not.toBeNull()
      expect(dragRegionBox).toMatchObject({
        y: tabBarBox?.y,
        height: tabBarBox?.height
      })
      expect(dragRegionBox?.width).toBeGreaterThan(0)
    }).toPass({ timeout: 5000 })
  }
)
