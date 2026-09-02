import { expect } from '@playwright/test'

import { agentConversationTest as test } from '@e2e/fixtures/agentConversationFixture'
import { VueNodeHelpers } from '@e2e/fixtures/VueNodeHelpers'

/**
 * Replay regression for PR #16611 (preserve root semantics for human graph
 * edits). Pre-fix, a node the user deleted INSIDE a subgraph minted a
 * root-scope `delete_node` wire op - the doc lost a root node it still had.
 * The fix refuses to mint subgraph-interior deletes (they have no wire
 * representation) while root-level deletes keep minting.
 *
 * The conversation only binds the follower to a doc seeded with a subgraph
 * definition and instance; the edits under test are HUMAN deletes through
 * the real canvas UI (deletes need no node definitions, so the mocked empty
 * object_info cannot starve them). Red at base with 0a20384d8a reverted:
 * the interior delete surfaces as an outbound delete op for node 10.
 */
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
      const vueNodes = new VueNodeHelpers(page)

      await agentConversation.sendPrompt()
      await agentConversation.replayResponse()
      await agentConversation.waitForTurnComplete()
      await expect(panel.getByTestId('agent-crdt-status')).toContainText(
        'connected'
      )

      const deletedNodeIds = () =>
        agentConversation
          .outboundOps()
          .filter((op) => op.op === 'delete_node')
          .map((op) => String((op as { node_id?: unknown }).node_id))

      // Positive control: a ROOT-level human delete must mint, proving the
      // doc-bound mint path is live in this environment.
      await page.locator('[data-node-id="1"]').click()
      await page.keyboard.press('Delete')
      await expect.poll(deletedNodeIds, { timeout: 10_000 }).toEqual(['1'])

      // The regression surface: delete a node INSIDE the seeded subgraph.
      await vueNodes.enterSubgraph('2')
      await page.locator('[data-node-id="10"]').click()
      await page.keyboard.press('Delete')

      // Ordering anchor: exit to root and delete the subgraph instance
      // itself (a root-level delete that must mint). Frames are sent in
      // order, so a minted interior delete would be on the wire before this
      // one - waiting for it gives the interior op every chance to surface
      // before the negative below is trusted.
      await page.getByTestId('subgraph-breadcrumb-back').click()
      await page.locator('[data-node-id="2"]').click()
      await page.keyboard.press('Delete')
      await expect
        .poll(() => deletedNodeIds().length, { timeout: 10_000 })
        .toBeGreaterThanOrEqual(2)

      // Exactly the two root deletes, in order; node 10 never minted.
      expect(deletedNodeIds()).toEqual(['1', '2'])
    })
  }
)
