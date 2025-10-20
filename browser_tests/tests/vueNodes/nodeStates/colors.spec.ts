import {
  comfyExpect as expect,
  comfyPageFixture as test
} from '../../../fixtures/ComfyPage'

test.describe('Vue Node Custom Colors', () => {
  test.beforeEach(async ({ comfyPage }) => {
    await comfyPage.setSetting('Comfy.UseNewMenu', 'Top')
    await comfyPage.setSetting('Comfy.Canvas.SelectionToolbox', true)
    await comfyPage.setSetting('Comfy.VueNodes.Enabled', true)
    await comfyPage.vueNodes.waitForNodes()
  })

  test('displays color picker button and allows color selection', async ({
    comfyPage
  }) => {
    const loadCheckpointNode = comfyPage.page.locator('[data-node-id]').filter({
      hasText: 'Load Checkpoint'
    })
    await loadCheckpointNode.getByText('Load Checkpoint').click()

    await comfyPage.page.locator('.selection-toolbox .pi-circle-fill').click()
    await comfyPage.page
      .locator('.color-picker-container')
      .locator('i[data-testid="blue"]')
      .click()

    await expect(comfyPage.canvas).toHaveScreenshot(
      'vue-node-custom-color-blue.png'
    )
  })

  test('should load node colors from workflow', async ({ comfyPage }) => {
    await comfyPage.loadWorkflow('nodes/every_node_color')
    await expect(comfyPage.canvas).toHaveScreenshot(
      'vue-node-custom-colors-dark-all-colors.png'
    )
  })

  test('should show brightened node colors on light theme', async ({
    comfyPage
  }) => {
    await comfyPage.setSetting('Comfy.ColorPalette', 'light')
    await comfyPage.loadWorkflow('nodes/every_node_color')
    await expect(comfyPage.canvas).toHaveScreenshot(
      'vue-node-custom-colors-light-all-colors.png'
    )
  })
})
