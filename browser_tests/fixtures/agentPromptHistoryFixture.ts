import { mergeTests } from '@playwright/test'
import type {
  AgentCancelAccepted,
  AgentMessage,
  AgentPostMessageRequest,
  AgentThreadListResponse,
  AgentTurnAccepted
} from '@comfyorg/ingest-types'
import { zAgentPostMessageRequest } from '@comfyorg/ingest-types/zod'

import type { AgentWsEvent } from '@/workbench/extensions/agent/schemas/agentApiSchema'

import { agentTest } from '@e2e/fixtures/agentPanelFixture'
import { workflowSelectionTest } from '@e2e/fixtures/agentWorkflowSelectionFixture'
import { jsonRoute } from '@e2e/fixtures/utils/jsonRoute'
import { webSocketFixture } from '@e2e/fixtures/ws'

const base = mergeTests(agentTest, workflowSelectionTest, webSocketFixture)

export const promptHistoryTest = base.extend<{
  promptHistory: {
    requests: AgentPostMessageRequest[]
    historyReads: () => number
  }
}>({
  promptHistory: async ({ page, workflowSelection, getWebSocket }, use) => {
    // Workflow selection boots the app before these agent-specific routes.
    void workflowSelection
    const requests: AgentPostMessageRequest[] = []
    const messages: AgentMessage[] = []
    let threadId = ''
    let historyReads = 0
    await page.route('**/api/agent/threads', (route) => {
      const threads: AgentThreadListResponse = {
        threads: threadId
          ? [
              {
                id: threadId,
                title: 'Inline reference round trip',
                preview: requests[0].content,
                workflow_id: requests[0].workflow_id ?? '',
                status: 'active',
                message_count: messages.length,
                created_at: '2026-09-11T10:00:00Z',
                updated_at: '2026-09-11T10:00:00Z',
                last_message_at: '2026-09-11T10:00:00Z'
              }
            ]
          : [],
        pagination: {
          offset: 0,
          limit: 100,
          total: threadId ? 1 : 0,
          has_more: false
        }
      }
      return route.fulfill(jsonRoute(threads))
    })
    await page.route('**/api/agent/threads/*/messages', (route) => {
      if (route.request().method() === 'GET') {
        historyReads++
        return route.fulfill(jsonRoute(messages))
      }
      const request = zAgentPostMessageRequest.parse(
        route.request().postDataJSON()
      )
      requests.push(request)
      threadId = new URL(route.request().url()).pathname.split('/').at(-2)!
      const messageId = `1dda6c2a-fdc5-45c3-b499-${String(requests.length).padStart(12, '0')}`
      messages.push(
        {
          id: `user-${requests.length}`,
          thread_id: threadId,
          turn_id: messageId,
          seq: messages.length + 1,
          role: 'user',
          status: 'complete',
          workflow_id: request.workflow_id,
          content: {
            text: request.content,
            workflow_references: request.workflow_references
          }
        },
        {
          id: messageId,
          thread_id: threadId,
          turn_id: messageId,
          seq: messages.length + 2,
          role: 'assistant',
          status: 'streaming'
        }
      )
      const accepted: AgentTurnAccepted = {
        thread_id: threadId,
        message_id: messageId
      }
      return route.fulfill({ ...jsonRoute(accepted), status: 202 })
    })
    await page.route(
      '**/api/agent/threads/*/messages/*/cancel',
      async (route) => {
        const messageId = new URL(route.request().url()).pathname
          .split('/')
          .at(-2)!
        const message = messages.find(({ id }) => id === messageId)
        if (message) message.status = 'interrupted'
        const accepted: AgentCancelAccepted = { status: 'cancelling' }
        await route.fulfill(jsonRoute(accepted))
        const done: AgentWsEvent = {
          type: 'agent_message_done',
          data: { message_id: messageId, thread_id: threadId }
        }
        const socket = await getWebSocket()
        socket.send(JSON.stringify(done))
      }
    )
    await use({ requests, historyReads: () => historyReads })
  }
})
