import {
  comfyExpect as expect,
  comfyPageFixture as test
} from '../../../fixtures/ComfyPage'

const BYPASS_HOTKEY = 'Control+b'
const BYPASS_CLASS = /before:bg-bypass\/60/

test.describe('Vue Node Bypass', () => {
  test.beforeEach(async ({ comfyPage }) => {
    await comfyPage.setSetting('Comfy.VueNodes.Enabled', true)
    await comfyPage.vueNodes.waitForNodes()
  })

  test('should allow toggling bypass on a selected node with hotkey', async ({
    comfyPage
  }) => {
    const checkpointNode = comfyPage.page.locator('[data-node-id]').filter({
      hasText: 'Load Checkpoint'
    })
    await checkpointNode.getByText('Load Checkpoint').click()
    await comfyPage.page.keyboard.press(BYPASS_HOTKEY)
    await expect(checkpointNode).toHaveClass(BYPASS_CLASS)

    await comfyPage.page.keyboard.press(BYPASS_HOTKEY)
    await expect(checkpointNode).not.toHaveClass(BYPASS_CLASS)
  })

  test('should allow toggling bypass on multiple selected nodes with hotkey', async ({
    comfyPage
  }) => {
    const checkpointNode = comfyPage.page.locator('[data-node-id]').filter({
      hasText: 'Load Checkpoint'
    })
    const ksamplerNode = comfyPage.page.locator('[data-node-id]').filter({
      hasText: 'KSampler'
    })

    await checkpointNode.getByText('Load Checkpoint').click()
    await ksamplerNode.getByText('KSampler').click({ modifiers: ['Control'] })
    await comfyPage.page.keyboard.press(BYPASS_HOTKEY)
    await expect(checkpointNode).toHaveClass(BYPASS_CLASS)
    await expect(ksamplerNode).toHaveClass(BYPASS_CLASS)

    await comfyPage.page.keyboard.press(BYPASS_HOTKEY)
    await expect(checkpointNode).not.toHaveClass(BYPASS_CLASS)
    await expect(ksamplerNode).not.toHaveClass(BYPASS_CLASS)
  })
})
