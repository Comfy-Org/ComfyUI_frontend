import { expect } from '@playwright/test'

import { agentConversationTest as test } from '@e2e/fixtures/agentConversationFixture'

test.describe(
  'Agent delete and clear operations',
  { tag: ['@cloud', '@vue-nodes'] },
  () => {
    test.describe('delete_node', () => {
      test.use({ conversationCase: 'agent-rec-add-set-delete' })

      test('removes the requested node while preserving the workflow', async ({
        agentConversation
      }) => {
        test.setTimeout(90_000)

        await agentConversation.runTurns()

        await expect(agentConversation.vueNodes.nodes).toHaveCount(5)
        await expect(
          agentConversation.vueNodes.getNodeLocator('2785690574723683')
        ).toHaveCount(0)
      })
    })

    test.describe('clear_canvas', () => {
      test.use({ conversationCase: 'agent-rec-clear-workflow' })

      test('leaves the canvas empty after clearing the workflow', async ({
        agentConversation
      }) => {
        test.setTimeout(90_000)
        const added =
          agentConversation.vueNodes.getNodeLocator('3802035302970761')

        await agentConversation.runTurns(async (ops) => {
          if (ops.some((op) => op.op === 'clear'))
            await expect(added).toHaveCount(1)
        })

        await expect(agentConversation.vueNodes.nodes).toHaveCount(0)
      })
    })
  }
)
