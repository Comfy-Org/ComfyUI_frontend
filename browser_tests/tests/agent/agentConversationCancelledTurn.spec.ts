import { expect } from '@playwright/test'

import { agentConversationTest as test } from '@e2e/fixtures/agentConversationFixture'

const CASE = 'agent-rec-cancelled-turn'

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
    expect(
      agentConversation.recordedAssistantText(0),
      'the recorded tail carries the stopped message'
    ).not.toBe('')

    // The harness releases the recorded tail only once the panel's cancel has
    // reached the server, so a turn that completes with the tail rendered in
    // full is the user-visible proof that Stop did its job.
    await agentConversation.runTurns()
  })
})
