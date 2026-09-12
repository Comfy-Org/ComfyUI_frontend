import { expect } from '@playwright/test'

import { agentConversationTest as test } from '@e2e/fixtures/agentConversationFixture'

const RECORDED_CASE = 'agent-rec-two-turn-dependent-edit'

test.describe('Agent replay video demo', { tag: '@cloud' }, () => {
  test.use({ conversationCase: RECORDED_CASE })

  test('replays a recorded two-turn agent session', async ({
    agentConversation
  }) => {
    test.setTimeout(90_000)
    await agentConversation.runTurns()

    await expect(
      agentConversation.panel.getByRole('button', {
        name: `Open ${agentConversation.conversation.workflow.name}`
      })
    ).toBeVisible()
  })
})
