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
import { jsonRoute } from '@e2e/fixtures/utils/jsonRoute'

// One turn in which the agent adds three nodes to a seeded graph, so the chat
// ends bound to a workflow document that holds nodes.
const CONVERSATION_CASE = 'agent-rec-three-sequential-adds'
const NEW_CHAT_THREAD_ID = '4b8e2c6a-1d3f-4e57-9a80-2c7d5e9f1b33'
const NEW_CHAT_TURN_ID = '9f1d3b5c-7a2e-4c68-8d41-6e0a2b4c8d55'
const FRESH_WORKFLOW_ID = 'c2d4e6f8-0a1b-4c3d-9e5f-7a8b9c0d1e2f'

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
  'Agent new chat after clearing the canvas',
  { tag: '@cloud' },
  () => {
    test.use({ conversationCase: CONVERSATION_CASE })

    test('starts the new chat against a blank workflow context, not the previous document', async ({
      agentConversation,
      page
    }) => {
      // A new chat started after clearing the canvas and deleting the previous
      // chat still posts its first turn against, and re-subscribes the canvas
      // to, the workflow document that chat built its nodes in.
      test.fail()
      test.setTimeout(90_000)
      const { panel } = agentConversation
      const previousWorkflowId = agentConversation.conversation.workflow.id
      const acceptedThreadIds: string[] = []
      const posted = await recordPostedTurns(page, acceptedThreadIds)
      await listAcceptedThreads(page, acceptedThreadIds, posted)

      // (a) One agent turn builds nodes on the canvas and binds the chat to
      // the recording's workflow document.
      await agentConversation.runTurns()
      expect(posted).toHaveLength(1)
      expect(posted[0].body.workflow_id).toBe(previousWorkflowId)
      await expect
        .poll(() => agentConversation.subscribeCount())
        .toBeGreaterThan(0)
      const nodeTitles = page.getByTestId('node-title')
      await expect(nodeTitles).not.toHaveCount(0)

      // (b) The user clears the canvas: select everything, delete it.
      const canvas = page.locator('#graph-canvas')
      await canvas.press('Control+a')
      await canvas.press('Delete')
      await expect(nodeTitles).toHaveCount(0)

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
      const framesBeforeNewChat = agentConversation.docFrames().length

      // (e) The first prompt of the new chat.
      const prompt = 'Build a text to image workflow'
      await panel.getByRole('textbox').fill(prompt)
      await panel.getByRole('button', { name: enMessages.agent.send }).click()
      await expect.poll(() => posted.length).toBe(2)
      const firstTurn = posted[1]
      expect(firstTurn.threadId).toBe('new')
      expect(firstTurn.body.draft?.content?.nodes).toEqual([])

      // The new chat's first turn must not be made against the workflow
      // document the deleted chat built its nodes in.
      expect(firstTurn.body.workflow_id).not.toBe(previousWorkflowId)

      // Nor may the canvas follower re-attach to that document once the turn is acked.
      const framesAfterNewChat = () =>
        agentConversation.docFrames().slice(framesBeforeNewChat)
      await expect
        .poll(() =>
          framesAfterNewChat().filter((frame) => frame.type === 'doc_subscribe')
        )
        .not.toHaveLength(0)
      expect(
        framesAfterNewChat()
          .filter((frame) => frame.type === 'doc_subscribe')
          .map((frame) => frame.workflowId)
      ).not.toContain(previousWorkflowId)
    })
  }
)
