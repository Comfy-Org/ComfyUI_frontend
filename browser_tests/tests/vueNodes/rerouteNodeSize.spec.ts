import type { Locator } from '@playwright/test'

import {
  comfyExpect as expect,
  comfyPageFixture as test
} from '@e2e/fixtures/ComfyPage'
import { screenshotRegion } from '@e2e/fixtures/utils/screenshotRegion'

const REROUTE_ID = '13'

const centerY = (locator: Locator) =>
  locator.boundingBox().then((box) => box && box.y + box.height / 2)

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
    const input = comfyPage.vueNodes.getInputSlotConnectionDot(REROUTE_ID, 0)
    const output = comfyPage.vueNodes.getOutputSlotConnectionDot(REROUTE_ID, 0)
    await expect(input).toBeVisible()

    await expect
      .poll(async () => {
        const [inputY, outputY] = await Promise.all([
          centerY(input),
          centerY(output)
        ])
        return inputY === null || outputY === null ? null : outputY - inputY
      })
      .toBe(0)
  })
})
