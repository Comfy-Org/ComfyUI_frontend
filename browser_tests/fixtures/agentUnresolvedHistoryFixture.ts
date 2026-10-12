import type {
  AgentMessage,
  AgentThreadListResponse,
  WorkflowListResponse
} from '@comfyorg/ingest-types'

import type { AgentTurnAccepted } from '@/workbench/extensions/agent/schemas/agentApiSchema'

import {
  agentTest,
  bootAgentApp,
  mockAgentTurnApi,
  mockWorkflowPersistence
} from '@e2e/fixtures/agentPanelFixture'
import { jsonRoute } from '@e2e/fixtures/utils/jsonRoute'

export const agentUnresolvedHistoryTest = agentTest.extend<{
  unresolvedHistory: { posted: unknown[]; chosenId: string }
}>({
  unresolvedHistory: async ({ page, agentFlagEnabled }, use) => {
    const threadId = 'e7b827c1-c5f8-4f92-9a37-5b7e41a03d18'
    const unresolvedId = 'df3a6e91-832d-44d2-a990-c8b1a7c99421'
    const chosenId = 'ba817a93-218d-4167-a13b-2aae419302e2'
    const at = '2026-10-01T12:00:00Z'
    const accepted: AgentTurnAccepted = {
      thread_id: threadId,
      message_id: 'd079c950-fc47-44ab-93ea-8397ad8e55b5',
      workflow_id: chosenId
    }
    const threads: AgentThreadListResponse = {
      threads: [
        {
          id: threadId,
          title: 'Unresolved workflow chat',
          preview: 'Earlier prompt',
          workflow_id: unresolvedId,
          status: 'active',
          message_count: 1,
          created_at: at,
          updated_at: at,
          last_message_at: at
        }
      ],
      pagination: { offset: 0, limit: 100, total: 1, has_more: false }
    }
    const messages: AgentMessage[] = [
      {
        id: 'history-user',
        thread_id: threadId,
        turn_id: 'e10506c0-05b2-4645-aade-baff356bc141',
        seq: 1,
        role: 'user',
        status: 'complete',
        workflow_id: unresolvedId,
        content: { text: 'Earlier prompt' }
      }
    ]
    const workflows: WorkflowListResponse = {
      data: [
        {
          id: unresolvedId,
          name: 'Missing saved file',
          created_by: 'test-user-e2e',
          created_at: at,
          updated_at: at,
          latest_version: 1
        }
      ],
      pagination: { offset: 0, limit: 100, total: 1, has_more: false }
    }
    const posted: unknown[] = []
    await bootAgentApp(page, agentFlagEnabled, {
      beforeNavigate: async (page) => {
        await mockAgentTurnApi(page, accepted)
        await mockWorkflowPersistence(page, chosenId, workflows.data)
        await page.route('**/api/agent/threads', (route) =>
          route.fulfill(jsonRoute(threads))
        )
        await page.route('**/api/agent/threads/*/messages', (route) => {
          if (route.request().method() === 'GET')
            return route.fulfill(jsonRoute(messages))
          posted.push(route.request().postDataJSON())
          return route.fulfill({ ...jsonRoute(accepted), status: 202 })
        })
      }
    })

    await use({ posted, chosenId })
  }
})
