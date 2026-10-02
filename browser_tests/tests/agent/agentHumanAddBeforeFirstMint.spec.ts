import { expect } from '@playwright/test'

import { agentConversationTest as test } from '@e2e/fixtures/agentConversationFixture'

test.describe(
  'Human edit before the first document mint',
  { tag: ['@cloud', '@agent', '@canvas', '@vue-nodes'] },
  () => {
    test.use({
      conversationCase: 'agent-rec-text-only-answer',
      humanOpsHost: 'pre_mint_once'
    })

    test('persists the edit after mint, reset, and resubscribe', async ({
      agentConversation
    }) => {
      test.setTimeout(90_000)
      await agentConversation.runTurns()

      const nodeId = await agentConversation.addNodeOfType('Note', [400, 400])
      await expect(
        agentConversation.vueNodes.getNodeLocator(nodeId)
      ).toBeVisible()
      await expect.poll(() => agentConversation.hostNodeIds()).toContain(nodeId)
      await expect
        .poll(
          () =>
            agentConversation
              .clientDocFrames()
              .filter((frame) => frame.type === 'doc_ops').length
        )
        .toBe(2)

      const [firstAttempt, retry] = agentConversation
        .clientDocFrames()
        .filter((frame) => frame.type === 'doc_ops')
      expect(firstAttempt.opIds).not.toHaveLength(0)
      expect(retry.opIds).toEqual(firstAttempt.opIds)

      const subscribes = agentConversation.subscribeCount()
      await agentConversation.reloadWithoutLocalWorkflow()
      await agentConversation.sendPrompt()
      await expect
        .poll(() => agentConversation.subscribeCount())
        .toBeGreaterThan(subscribes)

      await expect(
        agentConversation.vueNodes.getNodeLocator(nodeId)
      ).toBeVisible()
    })
  }
)
