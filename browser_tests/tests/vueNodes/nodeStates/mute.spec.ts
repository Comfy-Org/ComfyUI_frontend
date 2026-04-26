import {
  comfyExpect as expect,
  comfyPageFixture as test
} from '@e2e/fixtures/ComfyPage'

const MUTE_HOTKEY = 'Control+m'
const MUTE_OPACITY = '0.5'
const SELECTED_CLASS = /outline-node-component-outline/

test.describe('Vue Node Mute', { tag: '@vue-nodes' }, () => {
  test(
    'should allow toggling mute on a selected node with hotkey',
    { tag: '@screenshot' },
    async ({ comfyPage }) => {
      const checkpointNode =
        comfyPage.vueNodes.getNodeByTitle('Load Checkpoint')
      await comfyPage.page.getByText('Load Checkpoint').click()
      await expect(checkpointNode).toHaveClass(SELECTED_CLASS)

      await comfyPage.page.keyboard.press(MUTE_HOTKEY)
      await expect(checkpointNode).toHaveCSS('opacity', MUTE_OPACITY)
      await expect(comfyPage.canvas).toHaveScreenshot(
        'vue-node-muted-state.png'
      )

      await comfyPage.page.keyboard.press(MUTE_HOTKEY)
      await expect(checkpointNode).not.toHaveCSS('opacity', MUTE_OPACITY)
    }
  )

  test('should allow toggling mute on multiple selected nodes with hotkey', async ({
    comfyPage
  }) => {
    const checkpointNode = comfyPage.vueNodes.getNodeByTitle('Load Checkpoint')
    const ksamplerNode = comfyPage.vueNodes.getNodeByTitle('KSampler')

    await comfyPage.page.getByText('Load Checkpoint').click()
    await expect(checkpointNode).toHaveClass(SELECTED_CLASS)
    await comfyPage.page.getByText('KSampler').click({ modifiers: ['Control'] })
    await expect(ksamplerNode).toHaveClass(SELECTED_CLASS)

    await comfyPage.page.keyboard.press(MUTE_HOTKEY)
    await expect(checkpointNode).toHaveCSS('opacity', MUTE_OPACITY)
    await expect(ksamplerNode).toHaveCSS('opacity', MUTE_OPACITY)

    await comfyPage.page.keyboard.press(MUTE_HOTKEY)
    await expect(checkpointNode).not.toHaveCSS('opacity', MUTE_OPACITY)
    await expect(ksamplerNode).not.toHaveCSS('opacity', MUTE_OPACITY)
  })
})
