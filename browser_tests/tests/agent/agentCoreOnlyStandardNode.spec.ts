import { expect } from '@playwright/test'

import { agentConversationTest as test } from '@e2e/fixtures/agentConversationFixture'

test.describe(
  'recorded agent-rec-core-only-standard-node core-only Cloud workflow',
  { tag: ['@cloud', '@agent', '@vue-nodes'] },
  () => {
    test.use({
      conversationCase: 'agent-rec-core-only-standard-node'
    })

    test('shows only the recorded core node on the canvas', async ({
      agentConversation,
      page
    }) => {
      await agentConversation.runTurns()

      await expect(agentConversation.vueNodes.nodes).toHaveCount(1)
      await expect(
        page.getByTestId('node-title').filter({
          hasText: 'CLIP Text Encode (Prompt)'
        })
      ).toBeVisible()
    })
  }
)
