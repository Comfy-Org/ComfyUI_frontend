import { expect } from '@playwright/test'
import { comfyPageFixture as test } from './ComfyPage'

test.describe('Properties Panel', () => {
  test('Can change property value', async ({ comfyPage }) => {
    await comfyPage.setSetting('Comfy.UseNewMenu', 'Top')
    await comfyPage.rightClickEmptyLatentNode()
    await comfyPage.page.getByText('Properties Panel').click()
    await comfyPage.nextFrame()
    await expect(comfyPage.canvas).toHaveScreenshot(
      'right-click-node-properties-panel.png'
    )
    const propertyInput = comfyPage.page.locator('span.property_value').first()

    // Ensure no keybinds are triggered while typing
    await propertyInput.pressSequentially('abcdefghijklmnopqrstuvwxyz')
    await expect(comfyPage.canvas).toHaveScreenshot(
      'right-click-node-properties-panel-property-changed.png'
    )

    await propertyInput.fill('Empty Latent Image')
    await comfyPage.setSetting('Comfy.UseNewMenu', 'Disabled')
  })
})
