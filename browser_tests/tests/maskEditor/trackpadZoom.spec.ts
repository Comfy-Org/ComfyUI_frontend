import { expect } from '@playwright/test'

import { maskEditorTest as test } from '@e2e/fixtures/helpers/MaskEditorHelper'

test.describe(
  'Mask Editor trackpad zoom',
  { tag: ['@vue-nodes', '@canvas'] },
  () => {
    test('a high-resolution wheel delta produces only a proportional zoom step', async ({
      comfyPage,
      maskEditor
    }) => {
      const dialog = await maskEditor.openDialog()
      const pointerZone = dialog.getByTestId('pointer-zone')
      const canvasContainer = dialog.locator('#maskEditorCanvasContainer')
      const initialWidth = await canvasContainer.evaluate((element) =>
        Number.parseFloat((element as HTMLElement).style.width)
      )
      const pointerBox = await pointerZone.boundingBox()
      expect(pointerBox).not.toBeNull()

      await pointerZone.dispatchEvent('wheel', {
        deltaY: -1,
        clientX: pointerBox!.x + pointerBox!.width / 2,
        clientY: pointerBox!.y + pointerBox!.height / 2
      })
      await comfyPage.nextFrame()

      await expect
        .poll(async () => {
          const width = await canvasContainer.evaluate((element) =>
            Number.parseFloat((element as HTMLElement).style.width)
          )
          return width / initialWidth
        })
        .toBeCloseTo(1.000953556, 5)
    })
  }
)
