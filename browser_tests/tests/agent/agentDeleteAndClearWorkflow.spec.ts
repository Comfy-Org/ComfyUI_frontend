import { expect } from '@playwright/test'

import { agentConversationTest as test } from '@e2e/fixtures/agentConversationFixture'
import type { RecordedGraphOperation } from '@e2e/fixtures/data/agent/agentConversation'

function isClear(ops: readonly RecordedGraphOperation[]): boolean {
  return ops.some((op) => op.op === 'clear')
}

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

        await agentConversation.rememberRecoveryGraph()
        await agentConversation.runTurns()

        await expect(agentConversation.vueNodes.nodes).toHaveCount(5)
        await expect(
          agentConversation.vueNodes.getNodeLocator('2785690574723683')
        ).toHaveCount(0)
        expect(await agentConversation.isRecoveryGraphUnchanged()).toBe(true)
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

        await agentConversation.rememberRecoveryGraph()
        await agentConversation.runTurns({
          beforeGraphOps: async (ops) => {
            if (isClear(ops)) await expect(added).toHaveCount(1)
          }
        })

        await expect(agentConversation.vueNodes.nodes).toHaveCount(0)
        expect(await agentConversation.isRecoveryGraphUnchanged()).toBe(true)
      })

      // PM-1500 / PM-1504: a clear that landed while the bound tab's graph id
      // was unresolvable used to be rejected and left stale nodes on screen.
      test('clears the canvas on the clear frame even when the workflow scope is dropped', async ({
        agentConversation
      }) => {
        test.setTimeout(90_000)
        let restoreScope: (() => Promise<void>) | undefined

        await agentConversation.rememberRecoveryGraph()
        try {
          await agentConversation.sendPrompt(0)
          await agentConversation.replayResponse(0, {
            beforeGraphOps: async (ops) => {
              if (!isClear(ops)) return
              await expect(agentConversation.vueNodes.nodes).not.toHaveCount(0)
              restoreScope = await agentConversation.dropWorkflowScope()
            },
            waitForGraphOpsDelivery: isClear
          })
          if (!restoreScope)
            throw new Error('the clear frame never dropped workflow scope')

          await expect(agentConversation.vueNodes.nodes).toHaveCount(0)
          expect(await agentConversation.isRecoveryGraphUnchanged()).toBe(true)
        } finally {
          await restoreScope?.()
        }
      })
    })
  }
)
