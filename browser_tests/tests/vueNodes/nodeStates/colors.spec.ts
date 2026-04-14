import {
  comfyExpect as expect,
  comfyPageFixture as test
} from '@e2e/fixtures/ComfyPage'
import { TestIds } from '@e2e/fixtures/selectors'

test.describe(
  'Vue Node Custom Colors',
  { tag: ['@screenshot', '@vue-nodes'] },
  () => {
    test.beforeEach(async ({ comfyPage }) => {
      await comfyPage.settings.setSetting('Comfy.Canvas.SelectionToolbox', true)
    })

    test('displays color picker button and allows color selection', async ({
      comfyPage
    }) => {
      const loadCheckpointNode = comfyPage.page
        .locator('[data-node-id]')
        .filter({
          hasText: 'Load Checkpoint'
        })
      await loadCheckpointNode.getByText('Load Checkpoint').click()

      const colorPickerButton = comfyPage.page.getByTestId(
        TestIds.selectionToolbox.colorPickerButton
      )
      await colorPickerButton.click()

      const colorPickerGroup = comfyPage.page.getByRole('group').filter({
        has: comfyPage.page.getByTestId(TestIds.selectionToolbox.colorBlue)
      })
      await colorPickerGroup
        .getByTestId(TestIds.selectionToolbox.colorBlue)
        .click()

      await expect(loadCheckpointNode).toHaveScreenshot(
        'vue-node-custom-color-blue.png'
      )
    })

    test('should load node colors from workflow', async ({ comfyPage }) => {
      await comfyPage.workflow.loadWorkflow('nodes/every_node_color')
      await comfyPage.vueNodes.waitForNodes()
      await expect(comfyPage.canvas).toHaveScreenshot(
        'vue-node-custom-colors-dark-all-colors.png'
      )
    })

    test('should show brightened node colors on light theme', async ({
      comfyPage
    }) => {
      await comfyPage.settings.setSetting('Comfy.ColorPalette', 'light')
      await comfyPage.workflow.loadWorkflow('nodes/every_node_color')
      await comfyPage.vueNodes.waitForNodes()
      await expect(comfyPage.canvas).toHaveScreenshot(
        'vue-node-custom-colors-light-all-colors.png'
      )
    })
  }
)
