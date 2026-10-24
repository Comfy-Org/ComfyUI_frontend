import type {
  AgentThreadListResponse,
  AgentThreadSummary
} from '@comfyorg/ingest-types'

const LISTED_AT = '2026-10-01T00:00:00Z'

function agentThreadPage(
  threads: AgentThreadSummary[],
  nextCursor?: string
): AgentThreadListResponse {
  return {
    threads,
    pagination: {
      has_more: nextCursor !== undefined,
      ...(nextCursor !== undefined && { next_cursor: nextCursor }),
      limit: 100,
      offset: 0,
      total: 0
    }
  }
}

function agentThreadSummary(id: string, title: string): AgentThreadSummary {
  return {
    id,
    title,
    preview: title,
    status: 'active',
    message_count: 1,
    created_at: LISTED_AT,
    updated_at: LISTED_AT,
    last_message_at: LISTED_AT,
    workflow_id: ''
  }
}

export function emptyAgentThreadList(): AgentThreadListResponse {
  return agentThreadPage([])
}

const thirtyAgentThreads = Array.from({ length: 30 }, (_, index) =>
  agentThreadSummary(`thread-${index + 1}`, `Chat ${index + 1}`)
)

export const thirtyAgentThreadPages = {
  first: agentThreadPage(thirtyAgentThreads.slice(0, 20), 'thread-page-2'),
  second: agentThreadPage(thirtyAgentThreads.slice(20))
}
