import type { AgentEventSource } from '../../composables/agent/useAgentSession'
import { parseAgentWsEvent } from '../../schemas/agentApiSchema'

const RETRY_BASE_MS = 1_000
const RETRY_MAX_ATTEMPTS = 6

interface NodeCatalogRefreshDeps {
  refreshNodeDefinitions(): Promise<boolean>
  reloadCurrentWorkflow(): Promise<boolean>
  onSocketOpen(listener: () => void): () => void
  onError(error: unknown): void
}

function restartSucceeded(raw: unknown): string | null {
  const parsed = parseAgentWsEvent(raw)
  if (!parsed.success || parsed.data.type !== 'agent_tool_call') return null
  const { tool_call_id, tool_name, status } = parsed.data.data
  return tool_name === 'restart_comfyui' && status === 'success'
    ? tool_call_id
    : null
}

async function stepSucceeded(
  step: () => Promise<boolean>,
  onError: (error: unknown) => void
): Promise<boolean> {
  try {
    return await step()
  } catch (error) {
    onError(error)
    return false
  }
}

/**
 * Refreshes the node catalog after each successful `restart_comfyui`. A failed
 * refresh retries with backoff and whenever the agent socket opens again.
 */
export function refreshNodeCatalogOnRestart(
  events: AgentEventSource,
  deps: NodeCatalogRefreshDeps
): () => void {
  const calls = new Set<string>()
  let queue = Promise.resolve()
  let pending = false
  let failures = 0
  let stopped = false
  let retryTimer: ReturnType<typeof setTimeout> | null = null

  function cancelRetry(): void {
    if (retryTimer === null) return
    clearTimeout(retryTimer)
    retryTimer = null
  }

  function scheduleRetry(): void {
    if (stopped || failures >= RETRY_MAX_ATTEMPTS) return
    retryTimer = setTimeout(
      () => {
        retryTimer = null
        enqueue(retry)
      },
      RETRY_BASE_MS * 2 ** (failures - 1)
    )
  }

  async function refresh(): Promise<void> {
    if (stopped) return
    cancelRetry()
    pending =
      !(await stepSucceeded(deps.refreshNodeDefinitions, deps.onError)) ||
      !(await stepSucceeded(deps.reloadCurrentWorkflow, deps.onError))
    failures = pending ? failures + 1 : 0
    if (pending) scheduleRetry()
  }

  async function retry(): Promise<void> {
    if (pending) await refresh()
  }

  function enqueue(run: () => Promise<void>): void {
    queue = queue.then(run)
  }

  const stopListening = deps.onSocketOpen(() => {
    if (pending) enqueue(retry)
  })
  const unsubscribe = events.subscribe((raw) => {
    const callId = restartSucceeded(raw)
    if (callId === null || calls.has(callId)) return
    calls.add(callId)
    failures = 0
    enqueue(refresh)
  })

  return () => {
    stopped = true
    cancelRetry()
    stopListening()
    unsubscribe()
  }
}
