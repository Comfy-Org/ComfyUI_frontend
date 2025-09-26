import {
  comfyExpect as expect,
  comfyPageFixture as test
} from '../../../fixtures/ComfyPage'

const MUTE_HOTKEY = 'Control+m'
const MUTE_CLASS = /opacity-50/

test.describe('Vue Node Mute', () => {
  test.beforeEach(async ({ comfyPage }) => {
    await comfyPage.setSetting('Comfy.VueNodes.Enabled', true)
    await comfyPage.vueNodes.waitForNodes()
  })

  test('should allow toggling mute on a selected node with hotkey', async ({
    comfyPage
  }) => {
    await comfyPage.page.getByText('Load Checkpoint').click()
    await comfyPage.page.keyboard.press(MUTE_HOTKEY)

    const checkpointNode = comfyPage.vueNodes.getNodeByTitle('Load Checkpoint')
    await expect(checkpointNode).toHaveClass(MUTE_CLASS)

    await comfyPage.page.keyboard.press(MUTE_HOTKEY)
    await expect(checkpointNode).not.toHaveClass(MUTE_CLASS)
  })

  test('should allow toggling mute on multiple selected nodes with hotkey', async ({
    comfyPage
  }) => {
    await comfyPage.page.getByText('Load Checkpoint').click()
    await comfyPage.page.getByText('KSampler').click({ modifiers: ['Control'] })

    const checkpointNode = comfyPage.vueNodes.getNodeByTitle('Load Checkpoint')
    const ksamplerNode = comfyPage.vueNodes.getNodeByTitle('KSampler')

    await comfyPage.page.keyboard.press(MUTE_HOTKEY)
    await expect(checkpointNode).toHaveClass(MUTE_CLASS)
    await expect(ksamplerNode).toHaveClass(MUTE_CLASS)

    await comfyPage.page.keyboard.press(MUTE_HOTKEY)
    await expect(checkpointNode).not.toHaveClass(MUTE_CLASS)
    await expect(ksamplerNode).not.toHaveClass(MUTE_CLASS)
  })
})
