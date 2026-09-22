import { expect } from '@playwright/test'

import enMessages from '@/locales/en/main.json' with { type: 'json' }

import { agentNewChatTest as test } from '@e2e/fixtures/agentNewChatFixture'
import type { RecordedGraphOperation } from '@e2e/fixtures/data/agent/agentConversation'

// One turn in which the agent adds three nodes to a seeded graph, so the chat
// ends bound to a workflow document that holds nodes.
const CONVERSATION_CASE = 'agent-rec-three-sequential-adds'
const MARKER_NODE_ID = 424242
const DELETE_NODE_PREFIX = 'delete_node:'

// A host-side add after the re-subscribe: once it renders, the catch-up that
// preceded it on the same channel has been applied too.
const MARKER_ADD: RecordedGraphOperation = {
  op: 'add_node',
  node_id: MARKER_NODE_ID,
  class_type: 'PrimitiveStringMultiline',
  pos: [0, 0],
  node: {
    id: MARKER_NODE_ID,
    type: 'PrimitiveStringMultiline',
    pos: [0, 0],
    size: [240, 86],
    mode: 0,
    flags: {},
    order: 0,
    inputs: [],
    outputs: [{ name: 'STRING', type: 'STRING', links: [] }],
    properties: {},
    widgets_values: [null]
  }
}

test.describe(
  'Agent new chat on a cleared saved workflow',
  { tag: ['@cloud', '@vue-nodes'] },
  () => {
    test.use({ conversationCase: CONVERSATION_CASE, humanOpsHost: 'apply' })

    test('posts the cleared canvas as the first draft of the same workflow, and the canvas stays empty after the ack', async ({
      agentConversation,
      newChat,
      page
    }) => {
      test.setTimeout(90_000)
      const { panel } = agentConversation
      const workflowId = agentConversation.conversation.workflow.id
      const nodeTitles = page.getByTestId('node-title')
      const deletedNodeIds = () =>
        agentConversation
          .clientDocFrames()
          .filter((frame) => frame.type === 'doc_ops')
          .flatMap((frame) => frame.ops)
          .filter((op) => op.startsWith(DELETE_NODE_PREFIX))
          .map((op) => op.slice(DELETE_NODE_PREFIX.length))
          .toSorted()

      const canvasNodeIds =
        await test.step('agent builds nodes on the canvas', async () => {
          await agentConversation.runTurns()
          const posted = newChat.postedTurns()
          expect(posted).toHaveLength(1)
          expect(posted[0].body.workflow_id).toBe(workflowId)
          await expect
            .poll(() => agentConversation.subscribeCount())
            .toBeGreaterThan(0)
          await expect(nodeTitles).not.toHaveCount(0)
          const ids = await page.evaluate(() =>
            window.app!.graph.nodes.map((node) => String(node.id))
          )
          expect(ids.toSorted()).toEqual(
            agentConversation.hostNodeIds().toSorted()
          )
          return ids.toSorted()
        })

      // Every deletion is a human op the bound follower delivers to the
      // document. Waiting for all of them keeps the chat bound for the whole
      // delivery window; that window is the follower's own to narrow.
      await test.step('user clears the canvas', async () => {
        const canvas = page.locator('#graph-canvas')
        await canvas.press('Control+a')
        await canvas.press('Delete')
        await expect(nodeTitles).toHaveCount(0)
        await expect
          .poll(deletedNodeIds, { timeout: 15_000 })
          .toEqual(canvasNodeIds)
        expect(agentConversation.hostNodeIds()).toEqual([])
      })

      await test.step('user deletes the chat from history', async () => {
        await panel
          .getByRole('button', { name: enMessages.agent.showChatHistory })
          .click()
        const firstPrompt =
          agentConversation.conversation.turns[0].request.content
        await expect(
          panel.getByRole('button', { name: firstPrompt.slice(0, 60) })
        ).toBeVisible()
        await panel
          .getByRole('button', { name: enMessages.agent.chatOptions })
          .click()
        await page.getByRole('menuitem', { name: enMessages.g.delete }).click()
        await expect(
          panel.getByText(enMessages.agent.historyEmpty, { exact: true })
        ).toBeVisible()
      })

      const subscribesBeforeNewChat =
        await test.step('user starts a new chat', async () => {
          await panel
            .getByRole('button', { name: enMessages.agent.newChat })
            .click()
          await expect(panel.getByTestId('user-message-bubble')).toHaveCount(0)
          return agentConversation.subscribeCount()
        })

      await test.step('first prompt posts the cleared canvas as a new thread on the same workflow', async () => {
        await panel.getByRole('textbox').fill('Build a text to image workflow')
        await panel.getByRole('button', { name: enMessages.agent.send }).click()
        await expect.poll(() => newChat.postedTurns().length).toBe(2)
        const newChatTurn = newChat.postedTurns()[1]
        expect(newChatTurn.threadId).toBe('new')
        expect(newChatTurn.body.workflow_id).toBe(workflowId)
        expect(newChatTurn.body.draft?.content?.nodes).toEqual([])
      })

      // The document holds no nodes, so the catch-up brings nothing back:
      // the only node on the canvas is the one the host adds afterwards.
      await test.step('follower re-subscribes and the canvas stays empty', async () => {
        await expect
          .poll(() => agentConversation.subscribeCount())
          .toBe(subscribesBeforeNewChat + 1)
        agentConversation.pushHostOps([MARKER_ADD])
        await expect(
          agentConversation.vueNodes.getNodeLocator(String(MARKER_NODE_ID))
        ).toBeVisible()
        await expect(nodeTitles).toHaveCount(1)
      })
    })
  }
)
