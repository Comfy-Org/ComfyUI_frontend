import { expect } from '@playwright/test'
import type { Locator } from '@playwright/test'

import { comfyPageFixture as test } from '@e2e/fixtures/ComfyPage'

async function verifyCustomIconSvg(iconElement: Locator) {
  await expect
    .poll(async () => {
      const svgVariable = await iconElement.evaluate((element) =>
        getComputedStyle(element).getPropertyValue('--svg')
      )
      if (!svgVariable) return null
      const dataUrlMatch = svgVariable.match(
        /url\("data:image\/svg\+xml,([^"]+)"\)/
      )
      if (!dataUrlMatch) return null
      return decodeURIComponent(dataUrlMatch[1])
    })
    .toContain("<svg xmlns='http://www.w3.org/2000/svg'")
}

test.describe('Custom Icons', { tag: '@settings' }, () => {
  test('sidebar tab icons use custom SVGs', async ({ comfyPage }) => {
    // Find the icon in the sidebar
    const icon = comfyPage.page.locator(
      '.icon-\\[comfy--ai-model\\].side-bar-button-icon'
    )
    await expect(icon).toBeVisible()

    // Verify the custom SVG content
    await verifyCustomIconSvg(icon)
  })

  test('Browse Templates menu item uses custom template icon', async ({
    comfyPage
  }) => {
    // Open the topbar menu
    await comfyPage.menu.topbar.openTopbarMenu()
    const menuItem = comfyPage.menu.topbar.getMenuItem('Browse Templates')

    // Find the icon as a previous sibling of the menu item label
    const templateIcon = menuItem
      .locator('..')
      .locator('.icon-\\[comfy--template\\]')
    await expect(templateIcon).toBeVisible()

    // Verify the custom SVG content
    await verifyCustomIconSvg(templateIcon)
  })
})
