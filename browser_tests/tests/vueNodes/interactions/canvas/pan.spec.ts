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
    { tag: ['@screenshot', '@canvas'] },
    async ({ comfyPage, comfyMouse }) => {
      const node = comfyPage.vueNodes
        .getNodeByTitle('CLIP Text Encode (Prompt)')
        .first()
      await comfyMouse.mmbDragFromCenter(
        node,
        { dx: 140, dy: 90 },
        { steps: 10 }
      )

      await expect(comfyPage.canvas).toHaveScreenshot(
        'vue-nodes-paned-with-mmb-over-node.png'
      )
    }
  )
})
