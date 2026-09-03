import { expect } from '@playwright/test'

import { agentConversationTest as test } from '@e2e/fixtures/agentConversationFixture'

// Regression for #16611: a delete inside a subgraph must not mint a root-scope wire op.
// Edits go through the layout store because UI-path deletes cannot see follower-only nodes yet (FE-1996).

interface LayoutStoreModule {
  layoutStore: {
    getNodeLayout(
      graphId: string,
      nodeId: string
    ): { position: { x: number; y: number } } | null
    applyOperation(operation: Record<string, unknown>): void
  }
}

test.describe(
  'Agent replay regression: subgraph mint scope (PR #16611)',
  { tag: '@cloud' },
  () => {
    test.use({ conversationCase: 'agent-subgraph-mint-scope' })

    test('a human delete inside a subgraph does not mint a root wire op', async ({
      agentConversation,
      page
    }) => {
      test.setTimeout(45_000)
      const { panel } = agentConversation

      await agentConversation.sendPrompt()
      await agentConversation.replayResponse()
      await agentConversation.waitForTurnComplete()
      await expect(panel.getByTestId('agent-crdt-status')).toContainText(
        'connected'
      )
      await expect(page.locator('[data-node-id="1"]')).toBeVisible()

      const deletedNodeIds = () =>
        agentConversation
          .outboundOps()
          .filter((op) => op.op === 'delete_node')
          .map((op) => String((op as { node_id?: unknown }).node_id))

      const SUBGRAPH_ID = '9d1b2c3e-5f6a-4b7c-8d90-1e2f3a4b5c6d'
      const WORKFLOW_ID = agentConversation.conversation.workflow.id
      const STORE_MODULE = '/src/renderer/core/layout/store/layoutStore.ts'
      await page.evaluate(
        async ({ subgraphId, workflowId, storeModule }) => {
          const { layoutStore } = (await import(
            /* @vite-ignore */ storeModule
          )) as unknown as LayoutStoreModule
          // Layouts are keyed by the canvas root graph id, not the workflow id.
          const rootGraphId = [window.app!.graph.id, workflowId].find((id) =>
            layoutStore.getNodeLayout(id, '1')
          )
          if (!rootGraphId) {
            throw new Error(
              'seeded layout for node 1 not found under any graph'
            )
          }
          const meta = (nodeId: string, ownerGraphId: string) => ({
            graphId: rootGraphId,
            ownerGraphId,
            nodeId,
            timestamp: Date.now(),
            source: 'canvas'
          })

          // Positive control: a root-level delete must mint.
          layoutStore.applyOperation({
            type: 'deleteNode',
            ...meta('1', rootGraphId)
          })

          // Interior create and delete have no wire representation; neither may mint.
          layoutStore.applyOperation({
            type: 'createNode',
            ...meta('10', subgraphId),
            layout: {
              id: '10',
              position: { x: 120, y: 380 },
              size: { width: 210, height: 246 },
              zIndex: 0,
              visible: true,
              bounds: { x: 120, y: 380, width: 210, height: 246 }
            }
          })
          layoutStore.applyOperation({
            type: 'deleteNode',
            ...meta('10', subgraphId)
          })

          // A later root delete anchors the order: an interior mint would precede it.
          layoutStore.applyOperation({
            type: 'deleteNode',
            ...meta('2', rootGraphId)
          })
        },
        {
          subgraphId: SUBGRAPH_ID,
          workflowId: WORKFLOW_ID,
          storeModule: STORE_MODULE
        }
      )

      await expect
        .poll(() => deletedNodeIds().length, { timeout: 10_000 })
        .toBeGreaterThanOrEqual(2)

      expect(deletedNodeIds()).toEqual(['1', '2'])
    })
  }
)
