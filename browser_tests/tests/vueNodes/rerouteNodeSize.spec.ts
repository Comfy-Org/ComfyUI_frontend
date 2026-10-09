import type { Locator } from '@playwright/test'

import {
  comfyExpect as expect,
  comfyPageFixture as test
} from '@e2e/fixtures/ComfyPage'

const REROUTE_ID = '13'
const VAE_DECODE_ID = '12'

const centerY = (locator: Locator) =>
  locator.boundingBox().then((box) => box && box.y + box.height / 2)

const backgroundColor = (locator: Locator) =>
  locator.evaluate((element) => getComputedStyle(element).backgroundColor)

test.describe('Vue Reroute Node Size', { tag: '@vue-nodes' }, () => {
  test.use({ initialSettings: { 'Comfy.Minimap.Visible': false } })

  test.beforeEach(async ({ comfyPage }) => {
    await comfyPage.workflow.loadWorkflow('links/single_connected_reroute_node')
  })

  test(
    'reroute node visual appearance',
    { tag: '@screenshot' },
    async ({ comfyPage }) => {
      await comfyPage.expectScreenshot(
        comfyPage.canvas,
        'vue-reroute-node-compact.png'
      )
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
        return inputY !== null && inputY === outputY
      })
      .toBe(true)
  })

  test('reroute is painted with the node body color, not the title color', async ({
    comfyPage
  }) => {
    const rerouteBody = comfyPage.page.getByTestId(`node-body-${REROUTE_ID}`)
    const regularBody = comfyPage.page.getByTestId(`node-body-${VAE_DECODE_ID}`)
    await expect(regularBody).toBeVisible()

    await expect(comfyPage.vueNodes.getNodeInnerWrapper(REROUTE_ID)).toHaveCSS(
      'background-color',
      'rgba(0, 0, 0, 0)'
    )
    await expect
      .poll(async () => {
        const [reroute, regular] = await Promise.all([
          backgroundColor(rerouteBody),
          backgroundColor(regularBody)
        ])
        return reroute === regular
      })
      .toBe(true)
  })
})
