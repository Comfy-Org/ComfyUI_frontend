import {
  comfyExpect as expect,
  comfyPageFixture as test
} from '@e2e/fixtures/ComfyPage'
import { screenshotRegion } from '@e2e/fixtures/utils/screenshotRegion'
import { measureNodeSlotOffsets } from '@e2e/fixtures/utils/slotBoundsUtil'

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

  test('reroute input and output connect at the same height', async ({
    comfyPage
  }) => {
    await expect
      .poll(async () => {
        const data = await measureNodeSlotOffsets(comfyPage.page, '13')
        const offsets = data?.slots.map((slot) => slot.offsetY) ?? []
        return offsets.length === 2 ? offsets[1] - offsets[0] : null
      })
      .toBe(0)
  })
})
