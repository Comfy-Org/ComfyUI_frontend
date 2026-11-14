import type { AgentMessage, AgentThreadSummary } from '@comfyorg/ingest-types'

const SAVED_AT = '2026-10-01T12:00:00Z'

export interface AgentSavedChat {
  thread: AgentThreadSummary
  messages: AgentMessage[]
}

export function createAgentSavedChat({
  threadId,
  workflowId,
  title,
  prompt
}: {
  threadId: string
  workflowId: string
  title: string
  prompt: string
}): AgentSavedChat {
  return {
    thread: {
      id: threadId,
      title,
      preview: prompt,
      workflow_id: workflowId,
      status: 'active',
      message_count: 1,
      created_at: SAVED_AT,
      updated_at: SAVED_AT,
      last_message_at: SAVED_AT
    },
    messages: [
      {
        id: 'saved-chat-user',
        thread_id: threadId,
        turn_id: 'e10506c0-05b2-4645-aade-baff356bc141',
        seq: 1,
        role: 'user',
        status: 'complete',
        workflow_id: workflowId,
        content: { text: prompt }
      }
    ]
  }
}
