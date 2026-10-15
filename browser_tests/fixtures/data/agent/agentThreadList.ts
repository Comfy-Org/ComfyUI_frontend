import type {
  AgentThreadListResponse,
  AgentThreadSummary
} from '@comfyorg/ingest-types'

const LISTED_AT = '2026-10-01T00:00:00Z'

export const SECOND_THREAD_PAGE_CURSOR = 'thread-page-2'

export function emptyAgentThreadList(): AgentThreadListResponse {
  return {
    threads: [],
    pagination: { has_more: false, limit: 100, offset: 0, total: 0 }
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

export const firstAgentThreadPage: AgentThreadListResponse = {
  threads: [agentThreadSummary('thread-first-page', 'Chat on the first page')],
  pagination: {
    has_more: true,
    next_cursor: SECOND_THREAD_PAGE_CURSOR,
    limit: 100,
    offset: 0,
    total: 0
  }
}

export const secondAgentThreadPage: AgentThreadListResponse = {
  threads: [
    agentThreadSummary('thread-second-page', 'Chat on the second page')
  ],
  pagination: { has_more: false, limit: 100, offset: 0, total: 0 }
}
