import {
  comfyExpect as expect,
  comfyPageFixture as test
} from '../../../fixtures/ComfyPage'

const PIN_HOTKEY = 'p'
const PIN_INDICATOR = '[data-testid="node-pin-indicator"]'

test.describe('Vue Node Pin', () => {
  test.beforeEach(async ({ comfyPage }) => {
    await comfyPage.setSetting('Comfy.VueNodes.Enabled', true)
    await comfyPage.vueNodes.waitForNodes()
  })

  test('should allow toggling pin on a selected node with hotkey', async ({
    comfyPage
  }) => {
    await comfyPage.page.getByText('Load Checkpoint').click()
    await comfyPage.page.keyboard.press(PIN_HOTKEY)

    const checkpointNode = comfyPage.vueNodes.getNodeByTitle('Load Checkpoint')
    const pinIndicator = checkpointNode.locator(PIN_INDICATOR)

    await expect(pinIndicator).toBeVisible()

    await comfyPage.page.keyboard.press(PIN_HOTKEY)
    await expect(pinIndicator).not.toBeVisible()
  })

  test('should allow toggling pin on multiple selected nodes with hotkey', async ({
    comfyPage
  }) => {
    await comfyPage.page.getByText('Load Checkpoint').click()
    await comfyPage.page.getByText('KSampler').click({ modifiers: ['Control'] })

    const checkpointNode = comfyPage.vueNodes.getNodeByTitle('Load Checkpoint')
    const ksamplerNode = comfyPage.vueNodes.getNodeByTitle('KSampler')

    await comfyPage.page.keyboard.press(PIN_HOTKEY)
    const pinIndicator1 = checkpointNode.locator(PIN_INDICATOR)
    await expect(pinIndicator1).toBeVisible()
    const pinIndicator2 = ksamplerNode.locator(PIN_INDICATOR)
    await expect(pinIndicator2).toBeVisible()

    await comfyPage.page.keyboard.press(PIN_HOTKEY)
    await expect(pinIndicator1).not.toBeVisible()
    await expect(pinIndicator2).not.toBeVisible()
  })
})
