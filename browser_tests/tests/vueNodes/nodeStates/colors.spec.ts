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

    // Verify actual DOM properties for header and body colors
    const nodeHeader = loadCheckpointNode.locator(
      '[data-testid^="node-header-"]'
    )
    const nodeBody = loadCheckpointNode

    // Header should have blue header color (#223)
    await expect(nodeHeader).toHaveCSS('background-color', 'rgb(34, 34, 51)')

    // Node body should have blue body color (#335)
    await expect(nodeBody).toHaveCSS('background-color', 'rgb(51, 51, 85)')
  })

  // TODO: implement loading node colors from workflow in Vue system
  test.fail('should load node colors from workflow', async ({ comfyPage }) => {
    await comfyPage.loadWorkflow('nodes/every_node_color')
    await expect(comfyPage.canvas).toHaveScreenshot(
      'vue-node-custom-colors-dark-all-colors.png'
    )
  })

  // TODO: implement loading node colors from workflow in Vue system
  test.fail(
    'should show brightened node colors on light theme',
    async ({ comfyPage }) => {
      await comfyPage.setSetting('Comfy.ColorPalette', 'light')
      await comfyPage.loadWorkflow('nodes/every_node_color')
      await expect(comfyPage.canvas).toHaveScreenshot(
        'vue-node-custom-colors-light-all-colors.png'
      )
    }
  )
})
