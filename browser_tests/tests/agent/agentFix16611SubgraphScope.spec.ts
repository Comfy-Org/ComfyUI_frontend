import { expect } from '@playwright/test'

import { agentConversationTest as test } from '@e2e/fixtures/agentConversationFixture'

/**
 * Replay regression for PR #16611 (preserve root semantics for human graph
 * edits). Pre-fix, a node the user deleted INSIDE a subgraph minted a
 * root-scope `delete_node` wire op - the doc lost a root node it still had.
 * The fix refuses to mint subgraph-interior creates/deletes (they have no
 * wire representation) while root-level deletes keep minting.
 *
 * The conversation binds the follower to a doc seeded with a subgraph
 * definition and instance; the human edits are then driven at the layout
 * store level with the session's own local (user) actor, mirroring the
 * operations the canvas attach/detach emitters produce. Store-level driving
 * is deliberate: UI-path deletes route through litegraph selection and
 * cannot see ECS-only replay seeds (see the 16611 red-row diagnosis on the
 * DOPPELGANGER review pad) - the mint gate contract under test is exercised
 * exactly, the UI hit-testing above it is not.
 *
 * Red at base with 0a20384d8a reverted (reverse-apply the commit, then
 * RESTART the dev server - the spec imports the layout store by module URL,
 * which only resolves to the app's own instance against a module graph that
 * matches disk; running against an HMR-churned server loads a second, empty
 * store instance): the interior delete surfaces as an outbound
 * `delete_node` for node 10 (`['1', '10', '2']`).
 */

/** The layout-store surface this spec drives, structurally typed. */
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
  'Agent replay regression: #16611 subgraph scope',
  { tag: '@cloud' },
  () => {
    test.use({ conversationCase: 'agent-fix-16611-subgraph-scope' })

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
          // The follower keys layouts under the canvas root graph id; earlier
          // revisions keyed them under the doc's workflow id. Resolving by
          // lookup keeps the red half (fix reverted) driving the same seeded
          // layouts instead of erroring before the contract assertion.
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

          // Positive control: a ROOT-level delete must mint, proving the
          // doc-bound mint path is live in this environment.
          layoutStore.applyOperation({
            type: 'deleteNode',
            ...meta('1', rootGraphId)
          })

          // The regression surface: a node INSIDE the seeded subgraph. Its
          // layout attaches the way entering the subgraph attaches it
          // (ownerGraphId = the subgraph), then the user deletes it. Both the
          // create and the delete are unrepresentable on the wire - neither
          // may mint.
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

          // Ordering anchor: a second root-level delete that must mint.
          // Frames are sent in order, so a minted interior delete would be on
          // the wire before this one - waiting for it gives the interior op
          // every chance to surface before the negative below is trusted.
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

      // Exactly the two root deletes, in order; node 10 never minted.
      expect(deletedNodeIds()).toEqual(['1', '2'])
    })
  }
)
