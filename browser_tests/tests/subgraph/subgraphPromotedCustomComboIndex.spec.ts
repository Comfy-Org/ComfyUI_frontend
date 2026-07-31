import { expect } from '@playwright/test'

import { comfyPageFixture as test } from '@e2e/fixtures/ComfyPage'

// Repro fixture for https://github.com/Comfy-Org/ComfyUI/issues/15060 (FE-1456):
// a Custom Combo node's `choice` widget promoted through a subgraph boundary,
// wired to two "Preview as Text" (PreviewAny) nodes on its STRING and INDEX
// outputs.
const WORKFLOW = 'subgraphs/subgraph-custom-combo-promoted-choice'
const SUBGRAPH_NODE_TITLE = 'Custom Combo Subgraph'
const SUBGRAPH_NODE_ID = '5'
const INDEX_PREVIEW_NODE_ID = '3'

test.describe(
  'Custom Combo widget promotion',
  { tag: ['@subgraph', '@widget', '@vue-nodes'] },
  () => {
    test.beforeEach(async ({ comfyPage }) => {
      await comfyPage.settings.setSetting('Comfy.VueNodes.Enabled', true)
    })

    test('INDEX output tracks the promoted choice widget after execution', async ({
      comfyPage
    }) => {
      await comfyPage.workflow.loadWorkflow(WORKFLOW)
      await comfyPage.vueNodes.waitForNodes()

      // Change the promoted `choice` widget from outside the subgraph, on
      // the host SubgraphNode -- editing the promoted widget is the only
      // supported way to change a linked promotion's value post-ADR-0009.
      await comfyPage.vueNodes.selectComboOption(
        SUBGRAPH_NODE_TITLE,
        'choice',
        'four'
      )

      const responsePromise = comfyPage.page.waitForResponse('**/api/prompt')
      await comfyPage.command.executeCommand('Comfy.QueuePrompt')
      const response = await responsePromise
      expect(response.ok()).toBe(true)

      await comfyPage.vueNodes.enterSubgraph(SUBGRAPH_NODE_ID)
      await comfyPage.nextFrame()

      const indexPreviewNode = comfyPage.vueNodes.getNodeLocator(
        INDEX_PREVIEW_NODE_ID
      )
      const previewText = indexPreviewNode.getByRole('textbox', {
        name: 'preview_text'
      })

      // "four" is index 3 of ["one", "two", "three", "four"].
      await expect(previewText).toHaveValue('3', { timeout: 30_000 })
    })
  }
)
