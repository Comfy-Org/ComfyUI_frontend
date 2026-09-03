import { expect } from '@playwright/test'

import { agentConversationTest as test } from '@e2e/fixtures/agentConversationFixture'

test.describe('Agent conversation replay timing', { tag: '@cloud' }, () => {
  test.use({
    conversationCase: 'agent-rec-set-widget-existing',
    replayTiming: 'recorded'
  })

  test('replays the frames at their recorded offsets', async ({
    agentConversation
  }) => {
    test.setTimeout(120_000)
    const offsets = agentConversation.conversation.response.flatMap((entry) =>
      entry.at_ms === undefined ? [] : [entry.at_ms]
    )
    const span = offsets.length ? Math.max(...offsets) : undefined
    expect(span, 'the fixture carries at_ms offsets').toBeDefined()

    await agentConversation.sendPrompt()
    await agentConversation.replayResponse()
    await agentConversation.waitForTurnComplete()

    expect(agentConversation.replayElapsedMs).toBeGreaterThanOrEqual(span!)
    await expect
      .poll(() => agentConversation.graphSnapshot())
      .toEqual(agentConversation.expectedGraph())
  })
})
