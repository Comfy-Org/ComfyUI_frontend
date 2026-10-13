import { z } from 'zod'

import type { AgentEventSource } from '../../composables/agent/useAgentSession'

export interface NodeCatalogRefreshDeps {
  /** Rejects when the node definitions could not be loaded. */
  refreshNodeDefinitions(): Promise<unknown>
  /** `false` when the open workflow could not be rebuilt. */
  reloadCurrentWorkflow(): Promise<boolean>
  onFailure(error: unknown): void
}

const zRestartSucceeded = z.object({
  type: z.literal('agent_tool_call'),
  data: z.object({
    tool_call_id: z.string(),
    tool_name: z.literal('restart_comfyui'),
    status: z.literal('success')
  })
})

/** Re-registers node definitions and rebuilds the open workflow after the agent restarts ComfyUI. */
export function refreshNodeCatalogOnRestart(
  events: AgentEventSource,
  deps: NodeCatalogRefreshDeps
): () => void {
  const calls = new Map<string, 'pending' | 'done'>()
  let queue = Promise.resolve()

  async function refreshFor(callId: string): Promise<void> {
    let reloaded: boolean
    try {
      await deps.refreshNodeDefinitions()
      reloaded = await deps.reloadCurrentWorkflow()
    } catch (error) {
      calls.delete(callId)
      deps.onFailure(error)
      return
    }
    if (reloaded) calls.set(callId, 'done')
    else calls.delete(callId)
  }

  return events.subscribe((raw) => {
    const parsed = zRestartSucceeded.safeParse(raw)
    if (!parsed.success) return
    const callId = parsed.data.data.tool_call_id
    if (calls.has(callId)) return
    calls.set(callId, 'pending')
    queue = queue.then(() => refreshFor(callId))
  })
}
