import { comfyPageFixture as test } from '@e2e/fixtures/ComfyPage'
import { screenshotRegion } from '@e2e/fixtures/utils/screenshotRegion'

test.describe('Vue Reroute Node Size', { tag: '@vue-nodes' }, () => {
  test.use({ initialSettings: { 'Comfy.Minimap.Visible': false } })

  test.beforeEach(async ({ comfyPage }) => {
    await comfyPage.workflow.loadWorkflow('links/single_connected_reroute_node')
  })

  test(
    'reroute node visual appearance',
    { tag: '@screenshot' },
    async ({ comfyPage }) => {
      const region = await screenshotRegion(
        comfyPage.page,
        await comfyPage.vueNodes.nodes.all()
      )
      await region.expectScreenshot('vue-reroute-node-compact.png')
    }
  )
})
