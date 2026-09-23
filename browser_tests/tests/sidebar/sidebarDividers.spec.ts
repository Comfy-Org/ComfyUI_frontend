import { comfyPageFixture as test } from '@e2e/fixtures/ComfyPage'
import { expect } from '@playwright/test'

for (const location of ['left', 'right'] as const) {
  test.describe(`${location} sidebar dividers`, () => {
    test.use({
      initialSettings: {
        'Comfy.Sidebar.Location': location,
        'Comfy.Sidebar.Style': 'connected',
        'Comfy.ColorPalette': 'dark'
      }
    })

    test('gutter and toolbar use the same soft stroke as the tab bar', async ({
      comfyPage
    }) => {
      await comfyPage.menu.workflowsTab.open()
      await expect(
        comfyPage.page.getByRole('complementary', {
          name: 'Sidebar',
          exact: true
        })
      ).toBeVisible()

      const dividerColor = await comfyPage.menu.topbar.workflowTabs.evaluate(
        (element) => getComputedStyle(element).borderBottomColor
      )
      const gutter = comfyPage.page
        .getByRole('separator')
        .and(comfyPage.page.locator('.p-splitter-gutter'))
      await expect(gutter).toBeVisible()
      await expect(gutter).toHaveCSS('background-color', dividerColor)
      await expect(comfyPage.menu.sideToolbar).toHaveCSS(
        'border-right-color',
        dividerColor
      )
    })
  })
}
