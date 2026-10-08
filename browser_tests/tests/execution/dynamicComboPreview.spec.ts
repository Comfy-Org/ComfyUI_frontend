import { expect } from '@playwright/test'
import type { Page } from '@playwright/test'

import { comfyPageFixture as test } from '@e2e/fixtures/ComfyPage'

const PREVIEW_TEXT_TIMEOUT_MS = 15_000

async function expectPreviewTextContains(page: Page, expected: string) {
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
      const previewNode = await comfyPage.nodeOps.getNodeRefById('2')
      await sourceNode.click('title')
      await previewNode.click('title', { modifiers: ['Control'] })
      await sourceNode.convertToSubgraph()

      const subgraphNodeId = await comfyPage.subgraph.findSubgraphNodeId()
      const subgraphNode =
        await comfyPage.nodeOps.getNodeRefById(subgraphNodeId)

      await comfyPage.runButton.click()

      await subgraphNode.centerOnNode()
      await subgraphNode.navigateIntoSubgraph()

      await expectPreviewTextContains(comfyPage.page, 'DynamicCombo output')
    })
  }
)
