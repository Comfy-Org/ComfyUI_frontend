import type { AgentThreadListResponse } from '@comfyorg/ingest-types'

/**
 * `GET /api/agent/threads` answers with a *paginated* page, and the panel parses
 * the body against the generated contract before it reaches the chat history.
 * A body without `pagination` therefore throws inside `listThreads()`, and the
 * panel reports that throw as "Comfy Agent hit a server error." over the canvas
 * — an agent failure the user can see, raised by the mock rather than by the
 * agent.
 *
 * Ten mocks had independently drifted to a bare `{ threads: [] }`, so the empty
 * page has one definition here instead of eleven.
 */
export function emptyAgentThreadPage(): AgentThreadListResponse {
  return {
    threads: [],
    pagination: { offset: 0, limit: 100, total: 0, has_more: false }
  }
}
