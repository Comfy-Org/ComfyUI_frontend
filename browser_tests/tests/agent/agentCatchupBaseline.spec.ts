import { expect } from '@playwright/test'

import { agentConversationTest as test } from '@e2e/fixtures/agentConversationFixture'

// Regression for #16285: pre-fix the follower dropped the catch-up sent at the ack's seq and rendered empty.
test.describe(
  'Agent replay regression: catch-up baseline (PR #16285)',
  { tag: '@cloud' },
  () => {
    test.use({ conversationCase: 'agent-catchup-baseline' })

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
