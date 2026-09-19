import type { Page } from '@playwright/test'
import { expect } from '@playwright/test'
import type {
  AgentPostMessageRequest,
  AgentThreadListResponse
} from '@comfyorg/ingest-types'
import { zAgentPostMessageRequest } from '@comfyorg/ingest-types/zod'

import enMessages from '@/locales/en/main.json' with { type: 'json' }
import type { AgentTurnAccepted } from '@/workbench/extensions/agent/schemas/agentApiSchema'

import { agentConversationTest as test } from '@e2e/fixtures/agentConversationFixture'
import type { RecordedGraphOperation } from '@e2e/fixtures/data/agent/agentConversation'
import { jsonRoute } from '@e2e/fixtures/utils/jsonRoute'

// One turn in which the agent adds three nodes to a seeded graph, so the chat
// ends bound to a workflow document that holds nodes.
const CONVERSATION_CASE = 'agent-rec-three-sequential-adds'
const NEW_CHAT_THREAD_ID = '4b8e2c6a-1d3f-4e57-9a80-2c7d5e9f1b33'
const NEW_CHAT_TURN_ID = '9f1d3b5c-7a2e-4c68-8d41-6e0a2b4c8d55'
const FRESH_WORKFLOW_ID = 'c2d4e6f8-0a1b-4c3d-9e5f-7a8b9c0d1e2f'
const MARKER_NODE_ID = 424242

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

interface PostedTurn {
  threadId: string
  body: AgentPostMessageRequest
}

// Records every turn the panel posts. The first one falls through to the
// conversation harness, which acks it against the recording's workflow; the
// ones after are acked the way the server does: the workflow the client
// named, or a freshly minted one when it named none.
async function recordPostedTurns(
  page: Page,
  acceptedThreadIds: string[]
): Promise<PostedTurn[]> {
  const posted: PostedTurn[] = []
  page.on('response', async (response) => {
    const request = response.request()
    if (
      request.method() !== 'POST' ||
      !/\/api\/agent\/threads\/[^/]+\/messages$/.test(
        new URL(response.url()).pathname
      )
    )
      return
    const accepted = (await response.json()) as AgentTurnAccepted
    acceptedThreadIds.push(accepted.thread_id)
  })
  await page.route('**/api/agent/threads/*/messages', (route) => {
    const request = route.request()
    if (request.method() !== 'POST') return route.fallback()
    const threadId = new URL(request.url()).pathname.split('/').at(-2)!
    posted.push({
      threadId,
      body: zAgentPostMessageRequest.parse(request.postDataJSON())
    })
    if (posted.length === 1) return route.fallback()
    const accepted: AgentTurnAccepted = {
      thread_id: NEW_CHAT_THREAD_ID,
      message_id: NEW_CHAT_TURN_ID,
      workflow_id: posted.at(-1)!.body.workflow_id ?? FRESH_WORKFLOW_ID
    }
    return route.fulfill({ ...jsonRoute(accepted), status: 202 })
  })
  return posted
}

// Lists the acked threads, titled by their first prompt, so the history
// screen has a row to delete.
async function listAcceptedThreads(
  page: Page,
  acceptedThreadIds: string[],
  posted: PostedTurn[]
): Promise<void> {
  await page.route('**/api/agent/threads', (route) => {
    const threads: AgentThreadListResponse = {
      threads: acceptedThreadIds.map((id, index) => ({
        id,
        title: posted[index]?.body.content ?? '',
        preview: posted[index]?.body.content ?? '',
        workflow_id: posted[index]?.body.workflow_id ?? '',
        status: 'active',
        message_count: 2,
        created_at: '2026-09-18T10:00:00Z',
        updated_at: '2026-09-18T10:00:00Z',
        last_message_at: '2026-09-18T10:00:00Z'
      })),
      pagination: {
        offset: 0,
        limit: 100,
        total: acceptedThreadIds.length,
        has_more: false
      }
    }
    return route.fulfill(jsonRoute(threads))
  })
}

test.describe(
  'Agent new chat on a cleared saved workflow',
  { tag: '@cloud' },
  () => {
    test.use({ conversationCase: CONVERSATION_CASE })

    test('posts the cleared canvas as the first draft of the same workflow, and the canvas stays empty after the ack', async ({
      agentConversation,
      page
    }) => {
      test.setTimeout(90_000)
      const { panel } = agentConversation
      const workflowId = agentConversation.conversation.workflow.id
      const acceptedThreadIds: string[] = []
      const posted = await recordPostedTurns(page, acceptedThreadIds)
      await listAcceptedThreads(page, acceptedThreadIds, posted)
      const deletedNodeIds = () =>
        agentConversation
          .docFrames()
          .filter((frame) => frame.type === 'doc_ops')
          .flatMap((frame) => frame.ops)
          .filter((op) => op.op === 'delete_node')
          .map((op) => String(op.node_id))
          .toSorted()

      // (a) One agent turn builds nodes on the canvas and binds the chat to
      // the recording's workflow document.
      await agentConversation.runTurns()
      expect(posted).toHaveLength(1)
      expect(posted[0].body.workflow_id).toBe(workflowId)
      await expect
        .poll(() => agentConversation.subscribeCount())
        .toBeGreaterThan(0)
      const nodeTitles = page.getByTestId('node-title')
      await expect(nodeTitles).not.toHaveCount(0)
      const canvasNodeIds = await page.evaluate(() =>
        window.app!.graph.nodes.map((node) => String(node.id))
      )
      expect(canvasNodeIds.toSorted()).toEqual(
        agentConversation.hostNodeIds().toSorted()
      )

      // (b) The user clears the canvas: select everything, delete it. Every
      // deletion is a human op the bound follower delivers to the document.
      // Waiting for all of them here keeps the chat bound for the whole
      // delivery window; that window is the follower's own to narrow.
      const canvas = page.locator('#graph-canvas')
      await canvas.press('Control+a')
      await canvas.press('Delete')
      await expect(nodeTitles).toHaveCount(0)
      await expect
        .poll(deletedNodeIds, { timeout: 15_000 })
        .toEqual(canvasNodeIds.toSorted())
      expect(agentConversation.hostNodeIds()).toEqual([])

      // (c) The user deletes the chat from the history screen.
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

      // (d) The user starts a new chat.
      await panel
        .getByRole('button', { name: enMessages.agent.newChat })
        .click()
      await expect(panel.getByTestId('user-message-bubble')).toHaveCount(0)
      const subscribesBeforeNewChat = agentConversation.subscribeCount()

      // (e) The first prompt of the new chat is a new thread on the SAME saved
      // workflow, carrying the cleared canvas as the draft the server
      // reconciles the document to.
      const prompt = 'Build a text to image workflow'
      await panel.getByRole('textbox').fill(prompt)
      await panel.getByRole('button', { name: enMessages.agent.send }).click()
      await expect.poll(() => posted.length).toBe(2)
      const firstTurn = posted[1]
      expect(firstTurn.threadId).toBe('new')
      expect(firstTurn.body.workflow_id).toBe(workflowId)
      expect(firstTurn.body.draft?.content?.nodes).toEqual([])

      // (f) After the ack the follower re-subscribes to that document and
      // catches up. The document holds no nodes, so nothing comes back: the
      // only node on the canvas is the one the host adds afterwards.
      await expect
        .poll(() => agentConversation.subscribeCount())
        .toBe(subscribesBeforeNewChat + 1)
      agentConversation.applyHostOps([MARKER_ADD])
      await expect(
        agentConversation.vueNodes.getNodeLocator(String(MARKER_NODE_ID))
      ).toBeVisible()
      await expect(nodeTitles).toHaveCount(1)
    })
  }
)
