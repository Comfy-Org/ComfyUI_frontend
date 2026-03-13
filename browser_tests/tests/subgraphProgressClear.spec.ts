import { expect } from '@playwright/test'

import { comfyPageFixture as test } from '../fixtures/ComfyPage'

test.describe(
  'Subgraph progress clear on navigation',
  { tag: ['@subgraph'] },
  () => {
    test('Stale progress is cleared on subgraph node after navigating back', async ({
      comfyPage
    }) => {
      await comfyPage.workflow.loadWorkflow('subgraphs/basic-subgraph')
      await comfyPage.nextFrame()

      // Find the subgraph node
      const subgraphNodeId = await comfyPage.page.evaluate(() => {
        const graph = window.app!.canvas.graph!
        const subgraphNode = graph.nodes.find(
          (n) => typeof n.isSubgraphNode === 'function' && n.isSubgraphNode()
        )
        return subgraphNode ? String(subgraphNode.id) : null
      })
      expect(subgraphNodeId).not.toBeNull()

      // Simulate a stale progress value on the subgraph node.
      // This happens when:
      //   1. User views root graph during execution
      //   2. Progress watcher sets node.progress = 0.5
      //   3. User enters subgraph
      //   4. Execution completes (nodeProgressStates becomes {})
      //   5. Watcher fires, clears subgraph-internal nodes, but root-level
      //      SubgraphNode isn't visible so it keeps stale progress
      //   6. User navigates back — watcher should fire and clear it
      await comfyPage.page.evaluate((nodeId) => {
        const node = window.app!.canvas.graph!.getNodeById(nodeId)!
        node.progress = 0.5
      }, subgraphNodeId!)

      // Verify progress is set
      const progressBefore = await comfyPage.page.evaluate((nodeId) => {
        return window.app!.canvas.graph!.getNodeById(nodeId)!.progress
      }, subgraphNodeId!)
      expect(progressBefore).toBe(0.5)

      // Navigate into the subgraph
      const subgraphNode = await comfyPage.nodeOps.getNodeRefById(
        subgraphNodeId!
      )
      await subgraphNode.navigateIntoSubgraph()

      // Verify we're inside the subgraph
      const inSubgraph = await comfyPage.page.evaluate(() => {
        const graph = window.app!.canvas.graph
        return !!graph && 'inputNode' in graph
      })
      expect(inSubgraph).toBe(true)

      // Navigate back to the root graph
      await comfyPage.page.keyboard.press('Escape')
      await comfyPage.nextFrame()

      // The progress watcher should fire when graph changes (because
      // nodeLocationProgressStates is empty {} and the watcher should
      // iterate canvas.graph.nodes to clear stale node.progress values).
      //
      // BUG: Without watching canvasStore.currentGraph, the watcher doesn't
      // fire on subgraph->root navigation when progress is already empty,
      // leaving stale node.progress = 0.5 on the SubgraphNode.
      await expect(async () => {
        const progressAfter = await comfyPage.page.evaluate((nodeId) => {
          return window.app!.canvas.graph!.getNodeById(nodeId)!.progress
        }, subgraphNodeId!)
        expect(progressAfter).toBeUndefined()
      }).toPass({ timeout: 2_000 })
    })
  }
)
