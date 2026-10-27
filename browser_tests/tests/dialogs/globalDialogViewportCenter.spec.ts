import {
  comfyExpect as expect,
  comfyPageFixture as test
} from '@e2e/fixtures/ComfyPage'
import type { Locator } from '@playwright/test'

test.describe('Viewport-centered dialog maximize', { tag: '@ui' }, () => {
  async function waitForLayout(dialog: Locator) {
    await expect(dialog).toBeVisible()
    await expect
      .poll(() => dialog.evaluate((element) => element.getAnimations().length))
      .toBe(0)
  }

  test('stays on screen when maximized and recenters when restored', async ({
    comfyPage
  }) => {
    await comfyPage.page.evaluate(() => {
      window.app!.extensionManager.dialog.showExtensionDialog({
        key: 'viewport-center-maximize',
        title: 'Viewport center',
        component: { render: () => null },
        dialogComponentProps: { centerOnViewport: true, maximizable: true }
      })
    })

    const dialog = comfyPage.page.getByRole('dialog', {
      name: 'Viewport center'
    })
    await waitForLayout(dialog)

    const viewport = comfyPage.page.viewportSize()
    expect(viewport, 'Playwright viewport is set').not.toBeNull()

    const framed = await dialog.boundingBox()
    expect(framed, 'Framed dialog is laid out').not.toBeNull()
    expect
      .soft(framed!.x + framed!.width / 2)
      .toBeCloseTo(viewport!.width / 2, 0)

    await dialog.getByRole('button', { name: 'Maximize dialog' }).click()
    await waitForLayout(dialog)

    await expect
      .poll(async () => {
        const box = await dialog.boundingBox()
        if (!box) return false
        return (
          box.x >= 0 &&
          box.y >= 0 &&
          box.x + box.width <= viewport!.width &&
          box.y + box.height <= viewport!.height
        )
      })
      .toBe(true)

    await dialog.getByRole('button', { name: 'Restore dialog' }).click()
    await waitForLayout(dialog)

    await expect(dialog).toHaveBounds(framed!, { numDigits: 1 })
  })
})
