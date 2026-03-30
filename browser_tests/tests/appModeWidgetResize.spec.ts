import type { Locator, Page } from '@playwright/test'

import {
  comfyPageFixture as test,
  comfyExpect as expect
} from '../fixtures/ComfyPage'

/** Drag the bottom-right resize handle of an element to resize it vertically. */
async function dragResizeHandle(page: Page, element: Locator, deltaY: number) {
  const box = await element.boundingBox()
  if (!box) throw new Error('Element not visible for resize')

  const handleX = box.x + box.width - 3
  const handleY = box.y + box.height - 3

  await page.mouse.move(handleX, handleY)
  await page.mouse.down()
  await page.mouse.move(handleX, handleY + deltaY, { steps: 5 })
  await page.mouse.up()
}

test.describe('App mode widget resize', { tag: '@ui' }, () => {
  test.beforeEach(async ({ comfyPage }) => {
    await comfyPage.page.evaluate(() => {
      window.app!.api.serverFeatureFlags.value = {
        ...window.app!.api.serverFeatureFlags.value,
        linear_toggle_enabled: true
      }
    })
    await comfyPage.settings.setSetting('Comfy.UseNewMenu', 'Top')
  })

  test('Drop zone is vertically resizable in app mode', async ({
    comfyPage
  }) => {
    const loadImageId = await comfyPage.nodeOps.addNode('LoadImage')
    await comfyPage.nextFrame()

    await comfyPage.appMode.enterAppModeWithInputs([[loadImageId, 'image']])
    await expect(comfyPage.appMode.linearWidgets).toBeVisible({
      timeout: 5000
    })

    const dropZone = comfyPage.appMode.linearWidgets.locator(
      '[data-slot="drop-zone-indicator"]'
    )
    await expect(dropZone).toBeVisible()

    const initialBox = await dropZone.boundingBox()
    expect(initialBox).toBeTruthy()

    await dragResizeHandle(comfyPage.page, dropZone, 100)

    await expect
      .poll(async () => (await dropZone.boundingBox())?.height)
      .toBeGreaterThan(initialBox!.height)
  })

  test('Textarea is vertically resizable in app mode', async ({
    comfyPage
  }) => {
    await comfyPage.appMode.enterAppModeWithInputs([['6', 'text']])
    await expect(comfyPage.appMode.linearWidgets).toBeVisible({
      timeout: 5000
    })

    const textarea = comfyPage.appMode.linearWidgets.locator('textarea').first()
    await expect(textarea).toBeVisible()

    const initialBox = await textarea.boundingBox()
    expect(initialBox).toBeTruthy()

    await dragResizeHandle(comfyPage.page, textarea, 100)

    await expect
      .poll(async () => (await textarea.boundingBox())?.height)
      .toBeGreaterThan(initialBox!.height)
  })
})
