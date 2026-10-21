import {
  comfyPageFixture as test,
  comfyExpect as expect
} from '@e2e/fixtures/ComfyPage'

test.describe(
  'bounding boxes undo resize',
  { tag: ['@widget', '@vue-nodes'] },
  () => {
    test.afterEach(async ({ comfyPage }) => {
      await comfyPage.canvasOps.resetView()
    })

    test('sets the height after undoing a bounding boxes resize', async ({
      comfyPage
    }) => {
      const boundingBoxesCanvas = comfyPage.page
        .getByTestId('bounding-boxes')
        .locator('canvas')
      const heightInput = comfyPage.page
        .getByLabel('height')
        .getByRole('spinbutton')

      await comfyPage.workflow.loadWorkflow('default')
      await comfyPage.nextFrame()

      // Add the Create Bounding Boxes node via the node search box, then place
      // it on the canvas.
      await comfyPage.searchBoxV2.openByDoubleClickCanvas({ x: 464, y: 272 })
      await comfyPage.searchBoxV2.input.fill('create bo')
      await comfyPage.searchBoxV2.input.press('Enter')
      await comfyPage.canvas.click()

      await comfyPage.canvas.click({ position: { x: 810, y: 203 } })
      await boundingBoxesCanvas.click({ position: { x: 319, y: 167 } })
      await comfyPage.canvas.click({ position: { x: 912, y: 373 } })

      await heightInput.click()
      await heightInput.fill('512')
      await heightInput.press('Enter')

      await comfyPage.canvas.click({ position: { x: 932, y: 221 } })
      await boundingBoxesCanvas.click({ position: { x: 331, y: 180 } })
      await comfyPage.canvas.click({ position: { x: 870, y: 376 } })

      await comfyPage.canvas.press('ControlOrMeta+z')
      await heightInput.fill('1024')

      comfyPage.page.once(
        'dialog',
        (dialog) => void dialog.dismiss().catch(() => {})
      )

      await expect(heightInput).toHaveValue('1024')
    })
  }
)
