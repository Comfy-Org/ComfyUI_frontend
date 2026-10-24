import {
  comfyExpect as expect,
  comfyPageFixture as test
} from '@e2e/fixtures/ComfyPage'
import { WidgetBoundingBoxesFixture } from '@e2e/fixtures/components/WidgetBoundingBoxes'

test.describe(
  'Widget Bounding Boxes undo',
  { tag: ['@widget', '@vue-nodes'] },
  () => {
    test.beforeEach(async ({ comfyPage }) => {
      await comfyPage.workflow.loadWorkflow('widgets/bounding_boxes_widget')
    })

    test('Canvas undo of a height change resizes the drawing area', async ({
      comfyPage
    }) => {
      test.fail(
        true,
        'The editor keeps the old size after canvas undo (QA Desk 1.58 e3592)'
      )
      const boxes = new WidgetBoundingBoxesFixture(
        comfyPage.vueNodes.getNodeLocator('1')
      )
      await expect(boxes.canvas).toBeVisible()
      await expect.poll(() => boxes.aspectRatio()).toBeCloseTo(1, 1)

      await boxes.drawBox(0.1, 0.4)
      await boxes.setHeight(512)
      await expect.poll(() => boxes.aspectRatio()).toBeCloseTo(2, 1)
      await boxes.drawBox(0.5, 0.8)

      await comfyPage.canvasOps.mouseClickAt({ x: 900, y: 400 })
      await comfyPage.keyboard.undo()

      await expect(boxes.height).toHaveValue('1024')
      await expect.poll(() => boxes.aspectRatio()).toBeCloseTo(1, 1)
    })
  }
)
