import { expect } from '@playwright/test'

import { agentConversationTest as test } from '@e2e/fixtures/agentConversationFixture'
import type { RecordedGraphOperation } from '@e2e/fixtures/data/agent/agentConversation'

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
        expect(await agentConversation.isRecoveryGraphUnchanged()).toBe(true)
      })
    })

    test.describe('clear_canvas', () => {
      test.use({ conversationCase: 'agent-rec-clear-workflow' })

      test('leaves the canvas empty after clearing the workflow', async ({
        agentConversation
      }) => {
        test.setTimeout(90_000)

        await agentConversation.rememberRecoveryGraph()
        await agentConversation.runTurns()
        expect(await agentConversation.isRecoveryGraphUnchanged()).toBe(true)
      })

      test('clears the canvas on its own after the clear frame is rejected for a dropped workflow scope', async ({
        agentConversation
      }) => {
        test.setTimeout(90_000)
        let restoreScope: (() => Promise<void>) | undefined
        const isClear = (ops: readonly RecordedGraphOperation[]) =>
          ops.some((op) => op.op === 'clear')

        await agentConversation.rememberRecoveryGraph()
        try {
          await test.step('deliver the clear while workflow scope is unavailable', async () => {
            await agentConversation.sendPrompt(0)
            await agentConversation.replayResponse(0, {
              beforeGraphOps: async (ops) => {
                if (!isClear(ops)) return
                await expect(agentConversation.vueNodes.nodes).not.toHaveCount(
                  0
                )
                restoreScope = await agentConversation.dropWorkflowScope()
              },
              waitForGraphOpsDelivery: isClear
            })
          })

          if (!restoreScope)
            throw new Error('the clear frame never dropped workflow scope')
          const restore = restoreScope

          await test.step('keep the same graph stale after the rejected clear', async () => {
            await expect(agentConversation.vueNodes.nodes).not.toHaveCount(0)
            expect(await agentConversation.isRecoveryGraphUnchanged()).toBe(
              true
            )
          })

          await test.step('clear without another frame when scope returns', async () => {
            await restore()
            await expect(agentConversation.vueNodes.nodes).toHaveCount(0)
            expect(await agentConversation.isRecoveryGraphUnchanged()).toBe(
              true
            )
          })
        } finally {
          await restoreScope?.()
        }
      })
    })
  }
)
