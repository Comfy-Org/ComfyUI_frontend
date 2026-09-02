import { expect } from '@playwright/test'

import { agentConversationTest as test } from '@e2e/fixtures/agentConversationFixture'

/**
 * Replay regression for PR #16285 (apply CRDT catch-up at acknowledged
 * sequence). The host sends `doc_subscribed(seq=N)` and THEN the catch-up
 * `doc_update(seq=N)` - the conversation fixture reproduces exactly that
 * ordering with the same seq on both frames. Pre-fix, the bridge recorded N
 * from the acknowledgement as the applied baseline and dropped the catch-up
 * as stale, so a fresh follower rendered an EMPTY graph. The seeded graph
 * projecting at all is the regression surface.
 *
 * Red recipe (recorded patch, no revertible commit on this base - the base
 * carries an evolved form of the fix): in layoutFollowerBridge's
 * onDocSubscribed, restore the pre-fix baseline write
 * `this.lastSeq = subscribed.seq ?? null` on the ok path.
 */
test.describe(
  'Agent replay regression: #16285 catch-up baseline',
  { tag: '@cloud' },
  () => {
    test.use({ conversationCase: 'agent-fix-16285-catchup-baseline' })

    test('the subscription catch-up projects the seeded graph', async ({
      agentConversation
    }) => {
      test.setTimeout(45_000)
      const { panel } = agentConversation

      await agentConversation.sendPrompt()
      await agentConversation.replayResponse()
      await agentConversation.waitForTurnComplete()

      await expect(panel.getByTestId('agent-crdt-status')).toContainText(
        'connected'
      )
      // The catch-up is the one applied update; pre-fix it is dropped as
      // stale and the count stays at 0.
      await expect(panel.getByTestId('agent-crdt-status')).toContainText(
        '1 updates'
      )
      await expect
        .poll(() => agentConversation.graphSnapshot())
        .toEqual([
          {
            id: '1',
            title: 'LoadImage',
            inputs: [],
            outputs: [true, false]
          },
          {
            id: '2',
            title: 'PreviewImage',
            inputs: [true],
            outputs: []
          }
        ])
    })
  }
)
