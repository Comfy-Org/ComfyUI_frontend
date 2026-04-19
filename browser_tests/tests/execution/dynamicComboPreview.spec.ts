import { expect } from '@playwright/test'

import { comfyPageFixture as test } from '@e2e/fixtures/ComfyPage'

test.describe(
  'DynamicCombo text preview',
  { tag: ['@workflow', '@subgraph'] },
  () => {
    test('shows text preview when DynamicCombo node is at top level', async ({
      comfyPage
    }) => {
      await comfyPage.workflow.loadWorkflow('execution/dynamic_combo_preview')

      const previewNode = await comfyPage.nodeOps.getNodeRefById('2')

      await comfyPage.command.executeCommand('Comfy.QueuePrompt')

      await expect
        .poll(async () => (await previewNode.getWidget(0)).getValue(), {
          timeout: 15_000
        })
        .toContain('DynamicCombo output')
    })

    test('shows text preview when DynamicCombo node is inside subgraph', async ({
      comfyPage
    }) => {
      await comfyPage.workflow.loadWorkflow('execution/dynamic_combo_preview')

      const sourceNode = await comfyPage.nodeOps.getNodeRefById('1')
      await comfyPage.canvas.click()
      await comfyPage.page.keyboard.press('Control+a')
      const subgraphNode = await sourceNode.convertToSubgraph()

      await comfyPage.command.executeCommand('Comfy.QueuePrompt')

      await subgraphNode.navigateIntoSubgraph()

      const previewNodes = await comfyPage.nodeOps.getNodeRefsByType(
        'PreviewAny',
        true
      )
      expect(previewNodes).toHaveLength(1)

      await expect
        .poll(async () => (await previewNodes[0].getWidget(0)).getValue(), {
          timeout: 15_000
        })
        .toContain('DynamicCombo output')
    })
  }
)
