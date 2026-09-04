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
    // Whatever the recorded tail said, rather than pinning the wording here.
    const tail = agentConversation.recordedAssistantText(0)
    expect(tail, 'the recorded tail carries the stopped message').not.toBe('')

    await agentConversation.sendPrompt()
    await agentConversation.replayResponse()
    await agentConversation.waitForTurnComplete()

    await expect(
      agentConversation.panel.getByTestId('markdown-stream').first()
    ).toContainText(tail)
    // The recorded frames keep arriving either way, so without this the test
    // stays green when the panel never issues the cancel at all.
    expect(agentConversation.cancelRequests).toEqual([
      agentConversation.cancelTarget(0)
    ])
    await expect
      .poll(() => agentConversation.renderedNodeIds())
      .toEqual(expect.arrayContaining(agentConversation.documentNodeIds()))
    // Each connect the recording asked for must render as two connected slot
    // rows, addressed by node id and slot index through the shared helpers.
    for (const {
      fromNode,
      fromSlot,
      toNode,
      toSlot
    } of agentConversation.recordedConnects()) {
      await expect(
        agentConversation.vueNodes.getOutputSlotRow(fromNode, fromSlot)
      ).toHaveClass(/lg-slot--connected/)
      await expect(
        agentConversation.vueNodes.getInputSlotRow(toNode, toSlot)
      ).toHaveClass(/lg-slot--connected/)
    }
  })
})
