import type { AgentThreadListResponse } from '@comfyorg/ingest-types'

export function emptyAgentThreadList(): AgentThreadListResponse {
  return {
    threads: [],
    pagination: { has_more: false, limit: 100, offset: 0, total: 0 }
  }
}
