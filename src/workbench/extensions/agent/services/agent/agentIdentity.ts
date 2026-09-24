import { readonly, ref } from 'vue'
import type { Ref } from 'vue'

/**
 * The identity the AGENT authenticated this client as, from
 * `GET /api/agent/identity` on every backend.
 *
 * Every canvas op carries an actor, `human:<user_id>:<tab>`, and the agent
 * refuses a batch whose actor is not the writer it authenticated — silently,
 * from the user's side, so the agent keeps reporting an empty canvas. The
 * panel never derives that id itself (a signed-in account's id in the backend
 * is not necessarily its Firebase uid); it asks the backend that enforces it.
 *
 * Null until it answers; the follower stays inactive until then. One lookup at
 * mount is not enough: a transient failure (the agent still starting, the
 * socket not yet up) left the id null for the page's life and the canvas never
 * synced. So the lookup is retried on the agent socket's next CONNECTED edge —
 * the same signal the follower resubscribes on, and the earliest sign the
 * agent is reachable again — behind an exponential backoff so a hard failure
 * does not spin while a flapping socket keeps announcing itself. An edge that
 * lands inside the backoff window is deferred to the end of the window, never
 * dropped, so a single reconnect is always enough once the window has passed.
 */
export const AGENT_IDENTITY_RETRY_BASE_MS = 1_000
export const AGENT_IDENTITY_RETRY_MAX_MS = 30_000

export interface AgentIdentityDeps {
  getIdentity(): Promise<{ userId: string }>
  /** The agent socket's connected edges. Returns the unsubscribe. */
  onConnected(listener: () => void): () => void
  /** Every failed lookup, so a broken identity route is surfaced, not swallowed. */
  onFailure(error: unknown): void
}

export interface ResolvedAgentIdentity {
  userId: Readonly<Ref<string | null>>
  stop(): void
}

export function resolveAgentIdentity(
  deps: AgentIdentityDeps
): ResolvedAgentIdentity {
  const userId = ref<string | null>(null)
  let inFlight = false
  let stopped = false
  let failures = 0
  let retryNotBefore = 0
  let deferredRetry: ReturnType<typeof setTimeout> | null = null
  // A connected edge that lands while a lookup is in flight is owed a retry
  // should that lookup fail — the socket may never announce itself again.
  let edgeDuringFlight = false

  async function attempt(): Promise<void> {
    if (stopped || inFlight || userId.value !== null) return
    inFlight = true
    try {
      userId.value = (await deps.getIdentity()).userId
    } catch (error) {
      failures += 1
      retryNotBefore =
        Date.now() +
        Math.min(
          AGENT_IDENTITY_RETRY_BASE_MS * 2 ** (failures - 1),
          AGENT_IDENTITY_RETRY_MAX_MS
        )
      deps.onFailure(error)
    } finally {
      inFlight = false
    }
    if (edgeDuringFlight) {
      edgeDuringFlight = false
      onConnected()
    }
  }

  function onConnected(): void {
    if (stopped || userId.value !== null) return
    if (inFlight) {
      edgeDuringFlight = true
      return
    }
    const wait = retryNotBefore - Date.now()
    if (wait <= 0) {
      void attempt()
      return
    }
    if (deferredRetry !== null) return
    deferredRetry = setTimeout(() => {
      deferredRetry = null
      void attempt()
    }, wait)
  }

  const stopConnected = deps.onConnected(onConnected)
  void attempt()

  return {
    userId: readonly(userId),
    stop() {
      stopped = true
      stopConnected()
      if (deferredRetry !== null) {
        clearTimeout(deferredRetry)
        deferredRetry = null
      }
    }
  }
}
