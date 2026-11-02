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
    const input = comfyPage.vueNodes.getInputSlotConnectionDot('13', 0)
    const output = comfyPage.vueNodes.getOutputSlotConnectionDot('13', 0)
    await expect(input).toBeVisible()
    await expect(output).toBeVisible()

    await expect
      .poll(async () => {
        const [inputBox, outputBox] = await Promise.all([
          input.boundingBox(),
          output.boundingBox()
        ])
        return inputBox && outputBox
          ? outputBox.y +
              outputBox.height / 2 -
              (inputBox.y + inputBox.height / 2)
          : null
      })
      .toBe(0)
  })
})
