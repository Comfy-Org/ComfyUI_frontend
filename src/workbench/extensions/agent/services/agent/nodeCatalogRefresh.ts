import { z } from 'zod'

import type { AgentEventSource } from '../../composables/agent/useAgentSession'

/**
 * Keeps the canvas's node types in step with a ComfyUI the agent restarted.
 *
 * The agent restarts ComfyUI (`restart_comfyui`) after it writes or installs a
 * custom node pack. The page registered its node types when it loaded, so a
 * node from the new pack rendered as a missing-type placeholder, and the
 * workflow would not run, until the user reloaded the page. After each
 * successful restart this does what ComfyUI Manager's "apply changes" does
 * after its own: register the node definitions again, then rebuild the open
 * workflow from its in-memory state, so placeholders become the real nodes
 * and unsaved edits survive.
 */
export interface NodeCatalogRefreshDeps {
  refreshNodeDefinitions(): Promise<unknown>
  reloadCurrentWorkflow(): Promise<unknown>
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

/** Subscribes to `events`; returns the unsubscribe. */
export function refreshNodeCatalogOnRestart(
  events: AgentEventSource,
  deps: NodeCatalogRefreshDeps
): () => void {
  // A reconnect can deliver the same call again; one restart, one refresh.
  // Only a refresh that succeeded is final: a failed one forgets its call, so
  // a redelivery of that same call gets another attempt.
  const refreshed = new Set<string>()
  const inFlight = new Set<string>()
  // Two restarts in quick succession refresh in order, never interleaved.
  let queue = Promise.resolve()

  async function refreshFor(callId: string): Promise<void> {
    try {
      await deps.refreshNodeDefinitions()
      await deps.reloadCurrentWorkflow()
    } catch (error) {
      inFlight.delete(callId)
      deps.onFailure(error)
      return
    }
    inFlight.delete(callId)
    refreshed.add(callId)
  }

  return events.subscribe((raw) => {
    const parsed = zRestartSucceeded.safeParse(raw)
    if (!parsed.success) return
    const callId = parsed.data.data.tool_call_id
    if (refreshed.has(callId) || inFlight.has(callId)) return
    inFlight.add(callId)
    queue = queue.then(() => refreshFor(callId))
  })
}
