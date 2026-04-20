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
    async ({ comfyPage }) => {
      const node = comfyPage.vueNodes
        .getNodeByTitle('CLIP Text Encode (Prompt)')
        .first()
      const box = await node.boundingBox()
      if (!box) throw new Error('Node bounding box not found')

      const center = { x: box.x + box.width / 2, y: box.y + box.height / 2 }
      await comfyPage.canvasOps.middleClickDrag(center, {
        x: center.x + 140,
        y: center.y + 90
      })
      await comfyPage.nextFrame()

      await expect(comfyPage.canvas).toHaveScreenshot(
        'vue-nodes-mmb-pan-on-node.png'
      )
    }
  )
})
