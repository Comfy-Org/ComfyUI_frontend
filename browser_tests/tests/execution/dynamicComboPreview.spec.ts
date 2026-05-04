import { expect } from '@playwright/test'
import type { Page } from '@playwright/test'

import { comfyPageFixture as test } from '@e2e/fixtures/ComfyPage'

const PREVIEW_TEXT_TIMEOUT_MS = 15_000

const expectPreviewTextContains = async (page: Page, expected: string) => {
  const previewTextbox = page.getByRole('textbox', { name: 'preview_text' })
  await expect
    .poll(async () => previewTextbox.inputValue(), {
      timeout: PREVIEW_TEXT_TIMEOUT_MS
    })
    .toContain(expected)
}

test.describe(
  'DynamicCombo text preview',
  { tag: ['@workflow', '@subgraph'] },
  () => {
    test('shows text preview when DynamicCombo node is at top level', async ({
      comfyPage
    }) => {
      await comfyPage.workflow.loadWorkflow('execution/dynamic_combo_preview')

      await comfyPage.runButton.click()

      await expectPreviewTextContains(comfyPage.page, 'DynamicCombo output')
    })

    test('shows text preview when DynamicCombo node is inside subgraph', async ({
      comfyPage
    }) => {
      await comfyPage.workflow.loadWorkflow('execution/dynamic_combo_preview')

      const sourceNode = await comfyPage.nodeOps.getNodeRefById('1')
      await comfyPage.canvas.click()
      await comfyPage.page.keyboard.press('Control+a')
      const subgraphNode = await sourceNode.convertToSubgraph()

      await comfyPage.runButton.click()

      await subgraphNode.navigateIntoSubgraph()

      await expectPreviewTextContains(comfyPage.page, 'DynamicCombo output')
    })
  }
)
