import type { AgentEventSource } from '../../composables/agent/useAgentSession'
import { parseAgentWsEvent } from '../../schemas/agentApiSchema'

interface NodeCatalogRefreshDeps {
  refreshNodeDefinitions(): Promise<boolean>
  reloadCurrentWorkflow(): Promise<boolean>
}

function restartSucceeded(raw: unknown): string | null {
  const parsed = parseAgentWsEvent(raw)
  if (!parsed.success || parsed.data.type !== 'agent_tool_call') return null
  const { tool_call_id, tool_name, status } = parsed.data.data
  return tool_name === 'restart_comfyui' && status === 'success'
    ? tool_call_id
    : null
}

export function refreshNodeCatalogOnRestart(
  events: AgentEventSource,
  deps: NodeCatalogRefreshDeps
): () => void {
  const calls = new Set<string>()
  let queue = Promise.resolve()

  async function refreshFor(callId: string): Promise<void> {
    const refreshed =
      (await deps.refreshNodeDefinitions()) &&
      (await deps.reloadCurrentWorkflow())
    if (!refreshed) calls.delete(callId)
  }

  return events.subscribe((raw) => {
    const callId = restartSucceeded(raw)
    if (callId === null || calls.has(callId)) return
    calls.add(callId)
    queue = queue.then(() => refreshFor(callId))
  })
}
