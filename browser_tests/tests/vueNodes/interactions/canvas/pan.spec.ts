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
})
