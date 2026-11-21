import { expect } from '@playwright/test'

import { comfyPageFixture as test } from '@e2e/fixtures/ComfyPage'
import { collectConsoleErrors } from '@e2e/fixtures/utils/consoleErrorCollector'

// https://github.com/Comfy-Org/ComfyUI_frontend/issues/22898
test.describe(
  'Cyclic subgraph reference (FE #22898)',
  { tag: ['@subgraph'] },
  () => {
    test('loading and deleting a self-referencing subgraph does not crash the canvas', async ({
      comfyPage
    }) => {
      using consoleErrors = collectConsoleErrors(comfyPage.page)

      await comfyPage.workflow.loadWorkflow(
        'subgraphs/self-referencing-subgraph'
      )

      // The workflow's only root node is an instance of the subgraph that
      // (transitively) contains itself. Loading it alone exercises the
      // recursive hook-install pass over the cyclic structure.
      await comfyPage.expectNodeCount(1)

      const node = await comfyPage.nodeOps.getNodeRefById('1')
      await node.delete()

      // Deleting the node exercises the mirrored recursive hook-removal pass.
      await comfyPage.expectNodeCount(0)

      // The canvas must still be interactive after walking the cycle twice.
      await comfyPage.nodeOps.addNode('Note')
      await comfyPage.expectNodeCount(1)

      expect(
        consoleErrors.errors.filter((error) =>
          error.includes('Maximum call stack size exceeded')
        )
      ).toEqual([])
    })
  }
)
