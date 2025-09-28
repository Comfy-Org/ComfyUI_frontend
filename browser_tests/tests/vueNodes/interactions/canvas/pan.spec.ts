import {
  comfyExpect as expect,
  comfyPageFixture as test
} from '../../../../fixtures/ComfyPage'

test.describe('Vue Nodes Canvas Pan', () => {
  test.beforeEach(async ({ comfyPage }) => {
    await comfyPage.setSetting('Comfy.VueNodes.Enabled', true)
    await comfyPage.vueNodes.waitForNodes()
  })

  test('@mobile Can pan with touch', async ({ comfyPage }) => {
    await comfyPage.panWithTouch({ x: 64, y: 64 }, { x: 256, y: 256 })
    await expect(comfyPage.canvas).toHaveScreenshot(
      'vue-nodes-paned-with-touch.png'
    )
  })
})
