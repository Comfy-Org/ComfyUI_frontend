import type { Locator, Page } from '@playwright/test'

import {
  comfyPageFixture as test,
  comfyExpect as expect
} from '../fixtures/ComfyPage'

function tooltipLocator(page: Page): Locator {
  return page.locator('[role="tooltip"]')
}

async function hoverAway(page: Page): Promise<void> {
  await page.mouse.move(0, 0)
}

test.describe('BaseTooltip regression', { tag: '@ui' }, () => {
  test.beforeEach(async ({ comfyPage }) => {
    await comfyPage.settings.setSetting('Comfy.UseNewMenu', 'Top')
    await comfyPage.setup()
  })

  test('Queue history button shows tooltip on hover', async ({ comfyPage }) => {
    const queueButton = comfyPage.page.getByTestId('queue-overlay-toggle')
    await queueButton.hover()

    const tooltip = tooltipLocator(comfyPage.page)
    await expect(tooltip).toBeVisible()

    await hoverAway(comfyPage.page)
    await expect(tooltip).not.toBeVisible()
  })

  test('Toggle properties panel button shows tooltip on hover', async ({
    comfyPage
  }) => {
    const panelButton = comfyPage.page
      .getByLabel(/Toggle properties panel/i)
      .first()
    await panelButton.hover()

    const tooltip = tooltipLocator(comfyPage.page)
    await expect(tooltip).toBeVisible()

    await hoverAway(comfyPage.page)
    await expect(tooltip).not.toBeVisible()
  })
})
