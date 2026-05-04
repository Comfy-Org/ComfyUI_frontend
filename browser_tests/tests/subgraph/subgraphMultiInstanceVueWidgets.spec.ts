import { expect } from '@playwright/test'

import { comfyPageFixture as test } from '@e2e/fixtures/ComfyPage'

const MULTI_INSTANCE_WORKFLOW =
  'subgraphs/subgraph-multi-instance-promoted-text-values'

test.describe(
  'Multi-instance subgraph promoted widget rendering in Vue mode',
  { tag: ['@subgraph', '@vue-nodes', '@widget'] },
  () => {
    test.beforeEach(async ({ comfyPage }) => {
      await comfyPage.settings.setSetting('Comfy.VueNodes.Enabled', true)
    })

    test('Each subgraph instance renders its own promoted widget value, not the interior default', async ({
      comfyPage
    }) => {
      const expectedByNodeId: Record<string, string> = {
        '11': 'Alpha\n',
        '12': 'Beta\n',
        '13': 'Gamma\n'
      }

      await comfyPage.workflow.loadWorkflow(MULTI_INSTANCE_WORKFLOW)
      await comfyPage.vueNodes.waitForNodes(3)

      for (const [nodeId, expectedValue] of Object.entries(expectedByNodeId)) {
        const subgraphNode = comfyPage.vueNodes.getNodeLocator(nodeId)
        await expect(subgraphNode).toBeVisible()

        const textarea = subgraphNode.getByRole('textbox', {
          name: 'text',
          exact: true
        })
        await expect(textarea).toHaveValue(expectedValue)
      }
    })
  }
)
