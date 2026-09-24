import { expect } from '@playwright/test'

import { agentConversationTest as test } from '@e2e/fixtures/agentConversationFixture'
import {
  dropWorkflowScope,
  restoreWorkflowScope
} from '@e2e/fixtures/agentWorkflowScopeFixture'

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

        await agentConversation.runTurns()

        await expect(agentConversation.vueNodes.nodes).toHaveCount(0)
      })

      test('clears the canvas on its own after the clear frame is rejected for a dropped workflow scope', async ({
        agentConversation,
        page
      }) => {
        test.setTimeout(90_000)
        const workflowId = agentConversation.conversation.workflow.id
        let tabPath: string | undefined

        await test.step('setup: drop scope as the clear frame arrives', async () => {
          await agentConversation.sendPrompt(0)
          await agentConversation.replayResponse(
            0,
            undefined,
            async (index) => {
              const entry =
                agentConversation.conversation.turns[0].response[index]
              if (entry.kind !== 'graph_ops') return
              if (!entry.ops.some((op) => op.op === 'clear')) return
              // The seed workflow is empty, so the only node on screen at this
              // point is the one the turn's own earlier add_node frame placed.
              // hostSocket.send() does not wait for the page to receive and
              // apply that frame before this callback runs, so without this
              // wait the scope drop below can land before the add does,
              // rejecting it too and leaving nothing on screen to prove the
              // clear's rejection with.
              await expect(agentConversation.vueNodes.nodes).not.toHaveCount(0)
              tabPath = await dropWorkflowScope(page, workflowId)
            }
          )
        })

        if (tabPath === undefined)
          throw new Error('the clear frame never armed the scope drop')
        const droppedTabPath = tabPath

        await test.step('rejection: the same graph keeps its stale node', async () => {
          // Observing the same graph the whole way through (never switching
          // to a different tab) is what proves the clear was actually
          // rejected here, rather than trivially passing against an
          // already-empty replacement canvas.
          await expect(agentConversation.vueNodes.nodes).not.toHaveCount(0)
        })

        await test.step('autonomous recovery: scope returns, no new frame is sent', async () => {
          await restoreWorkflowScope(page, workflowId, droppedTabPath)
          // The self-driven retry clears the same canvas on its own; nothing
          // sends another frame after this point.
          await expect(agentConversation.vueNodes.nodes).toHaveCount(0)
        })
      })
    })
  }
)
