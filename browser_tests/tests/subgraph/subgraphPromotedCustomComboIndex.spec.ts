import type { Request } from '@playwright/test'
import { expect } from '@playwright/test'

import { comfyPageFixture as test } from '@e2e/fixtures/ComfyPage'
import type { PromptResponse } from '@/schemas/apiSchema'

// Repro fixture for https://github.com/Comfy-Org/ComfyUI/issues/15060 (FE-1456):
// a Custom Combo node's `choice` widget promoted through a subgraph boundary,
// wired to two "Preview as Text" (PreviewAny) nodes on its STRING and INDEX
// outputs.
const WORKFLOW = 'subgraphs/subgraph-custom-combo-promoted-choice'
const SUBGRAPH_NODE_TITLE = 'Custom Combo Subgraph'
const SUBGRAPH_HOST_NODE_ID = '5'
const INTERIOR_COMBO_NODE_ID = '1'

test.describe(
  'Custom Combo widget promotion',
  { tag: ['@subgraph', '@widget', '@vue-nodes'] },
  () => {
    test.beforeEach(async ({ comfyPage }) => {
      await comfyPage.settings.setSetting('Comfy.VueNodes.Enabled', true)
    })

    test('serializes INDEX from the promoted choice widget into the queued prompt', async ({
      comfyPage
    }) => {
      await comfyPage.workflow.loadWorkflow(WORKFLOW)
      await comfyPage.vueNodes.waitForNodes()

      // Change the promoted `choice` widget from outside the subgraph, on
      // the host SubgraphNode -- editing the promoted widget is the only
      // supported way to change a linked promotion's value post-ADR-PROMOTION.
      await comfyPage.vueNodes.selectComboOption(
        SUBGRAPH_NODE_TITLE,
        'choice',
        'four'
      )

      let queuedRequest: Request | undefined
      await comfyPage.page.route('**/api/prompt', async (route) => {
        queuedRequest = route.request()
        const promptResponse: PromptResponse = {
          prompt_id: '1',
          node_errors: {},
          error: ''
        }
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(promptResponse)
        })
      })

      await comfyPage.command.executeCommand('Comfy.QueuePrompt')
      await expect.poll(() => queuedRequest !== undefined).toBe(true)

      const promptInputs =
        queuedRequest!.postDataJSON().prompt[
          `${SUBGRAPH_HOST_NODE_ID}:${INTERIOR_COMBO_NODE_ID}`
        ].inputs

      // "four" is index 3 of ["one", "two", "three", "four"].
      expect(promptInputs.index).toBe(3)
    })
  }
)
