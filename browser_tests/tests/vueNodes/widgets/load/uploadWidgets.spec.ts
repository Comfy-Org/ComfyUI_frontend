import {
  comfyExpect as expect,
  comfyPageFixture as test
} from '../../../../fixtures/ComfyPage'

test.describe('Vue Upload Widgets', () => {
  test.beforeEach(async ({ comfyPage }) => {
    await comfyPage.setSetting('Comfy.VueNodes.Enabled', true)
    await comfyPage.vueNodes.waitForNodes()
  })

  test('should hide canvas-only upload buttons', async ({ comfyPage }) => {
    await comfyPage.setup()
    await comfyPage.loadWorkflow('widgets/all_load_widgets')
    await comfyPage.vueNodes.waitForNodes()

    await expect(comfyPage.canvas).toHaveScreenshot(
      'vue-nodes-upload-widgets.png'
    )
  })
})
