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
      const node = comfyPage.vueNodes.getNodeLocator('1')
      const boxes = new WidgetBoundingBoxesFixture(node)
      await expect(boxes.canvas).toBeVisible()
      await expect.poll(() => boxes.aspectRatio()).toBeCloseTo(1, 1)

      await boxes.drawBox(0.1, 0.4)
      await boxes.setHeight(512)
      await expect.poll(() => boxes.aspectRatio()).toBeCloseTo(2, 1)
      await boxes.drawBox(0.5, 0.8)

      const nodeBox = await node.boundingBox()
      if (!nodeBox) throw new Error('Bounding boxes node is not visible')
      await comfyPage.page.mouse.click(
        nodeBox.x + nodeBox.width + 40,
        nodeBox.y + 40
      )
      await comfyPage.keyboard.undo()

      await expect(boxes.height).toHaveValue('1024')
      await expect.poll(() => boxes.aspectRatio()).toBeCloseTo(1, 1)
    })
  }
)
