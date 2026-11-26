import type {
  AgentMessage,
  AgentRunMode,
  AgentThreadListResponse
} from '@comfyorg/ingest-types'

export const AGENT_COMPOSER_THREAD_ID = '7d342227-f9d2-4d25-90c0-81a5fa770209'

const SEEDED_AT = '2026-09-25T00:00:00Z'

export const agentComposerRunMode: AgentRunMode = {
  mode: 'ask_approval',
  credit_limit: null
}

export function createAgentComposerConversation(
  turnCount: number
): AgentMessage[] {
  return Array.from({ length: turnCount }, (_, index) => {
    const turn = index + 1
    const turnId = `37f549ae-4a07-4c27-a3d3-${String(turn).padStart(12, '0')}`
    const common = {
      thread_id: AGENT_COMPOSER_THREAD_ID,
      turn_id: turnId,
      status: 'complete' as const
    }
    return [
      {
        ...common,
        id: `user-${turn}`,
        seq: index * 2 + 1,
        role: 'user' as const,
        content: {
          text: `Turn ${turn}: adjust the workflow while preserving the existing composition.`
        }
      },
      {
        ...common,
        id: turnId,
        seq: index * 2 + 2,
        role: 'assistant' as const,
        content: {
          text: `Turn ${turn} is complete. I updated the requested settings and checked the graph for consistency.\n\n- The existing composition is preserved.\n- The workflow remains ready to run.`
        }
      }
    ]
  }).flat()
}

export function createAgentComposerThreadList(
  messages: AgentMessage[]
): AgentThreadListResponse {
  return {
    threads: [
      {
        created_at: SEEDED_AT,
        id: AGENT_COMPOSER_THREAD_ID,
        last_message_at: SEEDED_AT,
        message_count: messages.length,
        preview: 'Long composer performance conversation',
        status: 'active',
        title: 'Long composer performance conversation',
        updated_at: SEEDED_AT,
        workflow_id: ''
      }
    ],
    pagination: {
      has_more: false,
      limit: 100,
      offset: 0,
      total: 1
    }
  }
}
