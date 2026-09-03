import { expect } from '@playwright/test'

import { agentConversationTest as test } from '@e2e/fixtures/agentConversationFixture'
import { hasAgentConversation } from '@e2e/fixtures/data/agent/agentConversation'

const CASE = 'agent-rec-cancelled-turn'

// The recording lands with the data PR; without it there is nothing to replay.
if (hasAgentConversation(CASE))
  test.describe('Agent cancelled turn replay', { tag: '@cloud' }, () => {
    test.use({ conversationCase: CASE })

    test('stops where the recording stopped and keeps the edits that landed', async ({
      agentConversation
    }) => {
      const turn = agentConversation.conversation.turns[0]
      expect(
        turn.cancel_after,
        'the fixture records the entry the cancel followed'
      ).toBeDefined()
      // Whatever the recorded tail said, rather than pinning the wording here.
      const tail = turn.response
        .flatMap((entry) =>
          entry.kind === 'event' && entry.event.type === 'agent_message_delta'
            ? [String(entry.event.data.delta ?? '')]
            : []
        )
        .join('')
      expect(tail, 'the recorded tail carries the stopped message').not.toBe('')

      await agentConversation.sendPrompt()
      await agentConversation.replayResponse()
      await agentConversation.waitForTurnComplete()

      await expect(
        agentConversation.panel.getByTestId('markdown-stream').first()
      ).toContainText(tail)
      await expect
        .poll(() => agentConversation.graphSnapshot())
        .toEqual(agentConversation.expectedGraph())
    })
  })
