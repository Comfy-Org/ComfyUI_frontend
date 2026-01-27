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

    // Get viewport size and clip top 15%
    const viewportSize = comfyPage.page.viewportSize()
    const clipRegion = viewportSize
      ? {
          x: 0,
          y: Math.floor(viewportSize.height * 0.15),
          width: viewportSize.width,
          height: Math.ceil(viewportSize.height * 0.85)
        }
      : undefined

    await expect(comfyPage.canvas).toHaveScreenshot(
      'vue-nodes-paned-with-touch.png',
      { clip: clipRegion }
    )
  })
})
