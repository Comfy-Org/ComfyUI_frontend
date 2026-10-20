import {
  comfyExpect as expect,
  comfyPageFixture as test
} from '@e2e/fixtures/ComfyPage'
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
      const clip = await screenshotRegion(await comfyPage.vueNodes.nodes.all())
      await expect(comfyPage.page).toHaveScreenshot(
        'vue-reroute-node-compact.png',
        { clip }
      )
    }
  )
})
