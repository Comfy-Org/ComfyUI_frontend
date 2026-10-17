import type {
  AgentPostMessageRequest,
  WorkflowListResponse
} from '@comfyorg/ingest-types'

import type { AgentTurnAccepted } from '@/workbench/extensions/agent/schemas/agentApiSchema'

import {
  agentTest,
  bootAgentApp,
  mockAgentTurnApi,
  mockWorkflowPersistence
} from '@e2e/fixtures/agentPanelFixture'
import { createAgentSavedChat } from '@e2e/fixtures/data/agent/agentSavedChat'

export const agentUnresolvedHistoryTest = agentTest.extend<{
  unresolvedHistory: {
    posted: AgentPostMessageRequest[]
    chosenId: string
    chatTitle: string
    earlierPrompt: string
  }
}>({
  unresolvedHistory: async ({ page, agentFlagEnabled }, use) => {
    const threadId = 'e7b827c1-c5f8-4f92-9a37-5b7e41a03d18'
    const unresolvedId = 'df3a6e91-832d-44d2-a990-c8b1a7c99421'
    const chosenId = 'ba817a93-218d-4167-a13b-2aae419302e2'
    const at = '2026-10-01T12:00:00Z'
    const chatTitle = 'Unresolved workflow chat'
    const earlierPrompt = 'Earlier prompt'
    const accepted: AgentTurnAccepted = {
      thread_id: threadId,
      message_id: 'd079c950-fc47-44ab-93ea-8397ad8e55b5',
      workflow_id: chosenId
    }
    const savedChat = createAgentSavedChat({
      threadId,
      workflowId: unresolvedId,
      title: chatTitle,
      prompt: earlierPrompt
    })
    const listedWorkflows: WorkflowListResponse['data'] = [
      {
        id: unresolvedId,
        name: 'Missing saved file',
        created_by: 'test-user-e2e',
        created_at: at,
        updated_at: at,
        latest_version: 1
      }
    ]
    const posted = await mockAgentTurnApi(page, accepted, savedChat)
    await bootAgentApp(page, agentFlagEnabled, {
      beforeNavigate: (page) =>
        mockWorkflowPersistence(page, chosenId, listedWorkflows)
    })

    await use({ posted, chosenId, chatTitle, earlierPrompt })
  }
})
