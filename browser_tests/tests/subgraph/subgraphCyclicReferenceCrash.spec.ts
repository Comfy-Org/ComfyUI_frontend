import { expect } from '@playwright/test'

import { toNodeId } from '@comfyorg/graph-model/nodeId'

import { comfyPageFixture as test } from '@e2e/fixtures/ComfyPage'
import { collectConsoleErrors } from '@e2e/fixtures/utils/consoleErrorCollector'

test.describe(
  'Cyclic subgraph reference (FE #22898)',
  { tag: ['@subgraph'] },
  () => {
    test('loading and deleting a self-referencing subgraph does not crash the canvas', async ({
      comfyPage
    }) => {
      using consoleErrors = collectConsoleErrors(comfyPage.page)

      await test.step('Load a self-referencing subgraph', async () => {
        await comfyPage.workflow.loadWorkflow(
          'subgraphs/self-referencing-subgraph'
        )
        await comfyPage.expectNodeCount(1)

        const isCyclic = await comfyPage.page.evaluate((nodeId) => {
          const hostNode = window.app!.graph.getNodeById(nodeId)
          if (!hostNode || !hostNode.isSubgraphNode()) return false
          const innerNode = hostNode.subgraph.nodes[0]
          if (!innerNode.isSubgraphNode()) return false
          return innerNode.subgraph === hostNode.subgraph
        }, toNodeId(1))
        expect(isCyclic).toBe(true)
      })

      await test.step('Delete the host node', async () => {
        const node = await comfyPage.nodeOps.getNodeRefById('1')
        await node.delete()
        await comfyPage.expectNodeCount(0)
      })

      await test.step('Add a node after deletion', async () => {
        await comfyPage.searchBoxV2.addNode('Note')
        await comfyPage.nextFrame()
        await comfyPage.expectNodeCount(1)
      })

      expect(
        consoleErrors.errors.filter((error) =>
          error.includes('Maximum call stack size exceeded')
        )
      ).toEqual([])
    })
  }
)
