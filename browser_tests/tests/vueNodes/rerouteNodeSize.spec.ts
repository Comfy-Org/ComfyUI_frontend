import {
  comfyExpect as expect,
  comfyPageFixture as test
} from '@e2e/fixtures/ComfyPage'

test.describe('Vue Reroute Node Size', { tag: '@vue-nodes' }, () => {
  test.beforeEach(async ({ comfyPage }) => {
    await comfyPage.settings.setSetting('Comfy.Minimap.Visible', false)
    await comfyPage.workflow.loadWorkflow('links/single_connected_reroute_node')
    await comfyPage.vueNodes.waitForNodes()
  })

  test(
    'reroute node visual appearance',
    { tag: '@screenshot' },
    async ({ comfyPage }) => {
      await comfyPage.nextFrame()
      await expect(comfyPage.canvas).toHaveScreenshot(
        'vue-reroute-node-compact.png'
      )
    }
  )
})
