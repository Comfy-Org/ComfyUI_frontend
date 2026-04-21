import {
  comfyExpect as expect,
  comfyPageFixture as test
} from '@e2e/fixtures/ComfyPage'

test.describe('Vue Nodes Canvas Pan', { tag: '@vue-nodes' }, () => {
  test(
    '@mobile Can pan with touch',
    { tag: '@screenshot' },
    async ({ comfyPage }) => {
      await comfyPage.canvasOps.panWithTouch(
        { x: 64, y: 64 },
        { x: 256, y: 256 }
      )
      await expect(comfyPage.canvas).toHaveScreenshot(
        'vue-nodes-paned-with-touch.png'
      )
    }
  )

  test(
    'Middle-click drag on node should pan canvas',
    { tag: '@screenshot' },
    async ({ comfyPage, comfyMouse }) => {
      const node = comfyPage.vueNodes
        .getNodeByTitle('CLIP Text Encode (Prompt)')
        .first()
      await expect(node).toBeVisible()
      const nodeBounds = await node.boundingBox()
      if (!nodeBounds) throw new Error('Node bounding box not found')

      const start = {
        x: nodeBounds.x + nodeBounds.width / 2,
        y: nodeBounds.y + nodeBounds.height / 2
      }

      await comfyMouse.mmbDrag(
        start,
        { x: start.x + 140, y: start.y + 90 },
        { steps: 10 }
      )

      await expect(comfyPage.canvas).toHaveScreenshot(
        'vue-nodes-paned-with-mmb-over-node.png'
      )
    }
  )
})
