import {
  comfyExpect as expect,
  comfyPageFixture as test
} from '../../../fixtures/ComfyPage'

const BYPASS_HOTKEY = 'Control+b'
const BYPASS_CLASS = /before:bg-bypass\/60/

test.describe('Vue Node Bypass', () => {
  test.beforeEach(async ({ comfyPage }) => {
    await comfyPage.settings.setSetting('Comfy.VueNodes.Enabled', true)
    await comfyPage.settings.setSetting('Comfy.UseNewMenu', 'Top')
    await comfyPage.settings.setSetting('Comfy.Minimap.Visible', false)
    await comfyPage.settings.setSetting('Comfy.Graph.CanvasMenu', true)
    await comfyPage.vueNodes.waitForNodes()
  })

  test(
    'should allow toggling bypass on a selected node with hotkey',
    { tag: '@screenshot' },
    async ({ comfyPage }) => {
      await expect(comfyPage.page.getByText('Load Checkpoint')).toBeVisible()
      await comfyPage.page.getByText('Load Checkpoint').click()
      await comfyPage.page.keyboard.press(BYPASS_HOTKEY)

      const checkpointNode = comfyPage.page
        .locator('[data-node-id]')
        .filter({ hasText: 'Load Checkpoint' })
        .getByTestId('node-inner-wrapper')
      await expect(checkpointNode).toHaveClass(BYPASS_CLASS)
      await comfyPage.nextFrame()
      await expect(comfyPage.canvas).toHaveScreenshot(
        'vue-node-bypassed-state.png'
      )

      await comfyPage.page.keyboard.press(BYPASS_HOTKEY)
      await expect(checkpointNode).not.toHaveClass(BYPASS_CLASS)
    }
  )

  test('should allow toggling bypass on multiple selected nodes with hotkey', async ({
    comfyPage
  }) => {
    await expect(comfyPage.page.getByText('Load Checkpoint')).toBeVisible()
    await comfyPage.page.getByText('Load Checkpoint').click()
    await expect(comfyPage.page.getByText('KSampler')).toBeVisible()
    await comfyPage.page.getByText('KSampler').click({ modifiers: ['Control'] })

    const checkpointNode = comfyPage.page
      .locator('[data-node-id]')
      .filter({ hasText: 'Load Checkpoint' })
      .getByTestId('node-inner-wrapper')
    const ksamplerNode = comfyPage.page
      .locator('[data-node-id]')
      .filter({ hasText: 'KSampler' })
      .getByTestId('node-inner-wrapper')

    await comfyPage.page.keyboard.press(BYPASS_HOTKEY)
    await expect(checkpointNode).toHaveClass(BYPASS_CLASS)
    await expect(ksamplerNode).toHaveClass(BYPASS_CLASS)

    await comfyPage.page.keyboard.press(BYPASS_HOTKEY)
    await expect(checkpointNode).not.toHaveClass(BYPASS_CLASS)
    await expect(ksamplerNode).not.toHaveClass(BYPASS_CLASS)
  })
})
