import { expect } from '@playwright/test'

import { agentConversationTest as test } from '@e2e/fixtures/agentConversationFixture'

// Source: https://linear.app/comfyorg/issue/PM-914
const THREE_ADDS_CASE = 'agent-rec-three-sequential-adds'

test.describe('Agent edit undo/redo', { tag: ['@cloud', '@vue-nodes'] }, () => {
  test.use({ conversationCase: THREE_ADDS_CASE })

  test('redo restores an agent edit that was just undone', async ({
    agentConversation
  }) => {
    test.setTimeout(90_000)

    await test.step('Replay the agent edits', async () => {
      await agentConversation.runTurns()
      await expect
        .poll(async () => (await agentConversation.readNodeLens()).live.length)
        .toBe(agentConversation.hostNodeIds().length)
    })

    const afterAgentEdit = (await agentConversation.readNodeLens()).live.length
    expect(afterAgentEdit).toBeGreaterThan(0)

    await test.step('Undo the final agent edit', async () => {
      await agentConversation.keyboard.undo()
      await expect
        .poll(async () => (await agentConversation.readNodeLens()).live.length)
        .not.toBe(afterAgentEdit)
    })

    await test.step('Redo the final agent edit', async () => {
      await agentConversation.keyboard.redo()
      await expect
        .poll(async () => (await agentConversation.readNodeLens()).live.length)
        .toBe(afterAgentEdit)
    })
  })
})
