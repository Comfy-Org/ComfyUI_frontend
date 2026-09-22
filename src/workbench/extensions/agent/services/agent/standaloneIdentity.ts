import { readonly, ref } from 'vue'
import type { Ref } from 'vue'

/**
 * Standalone only: the identity the AGENT authenticated this client as.
 *
 * Attribution on `POST /doc/ops` is server-derived, and a batch whose ops
 * claim a different actor is refused with 403. In the cloud the panel's
 * session user matches what ingest forwards, so the claim agrees. Standalone
 * bootstraps a fixed local user that the panel cannot see, so it fell back to
 * "anonymous" and EVERY canvas edit was rejected — silently, which is why the
 * agent kept reporting an empty canvas no matter what was on screen.
 *
 * Asking the agent avoids hardcoding its bootstrap constant here. Null until
 * it answers; the follower stays inactive until then. One lookup at mount is
 * not enough: a transient failure (the agent still starting, the socket not
 * yet up) left the id null for the page's life and the canvas never synced.
 * So the lookup is retried on the standalone socket's next CONNECTED edge —
 * the same signal the follower resubscribes on, and the earliest sign the
 * agent is reachable again — behind an exponential backoff so a hard failure
 * does not spin while a flapping socket keeps announcing itself. An edge that
 * lands inside the backoff window is deferred to the end of the window, never
 * dropped, so a single reconnect is always enough once the window has passed.
 */
export const STANDALONE_IDENTITY_RETRY_BASE_MS = 1_000
export const STANDALONE_IDENTITY_RETRY_MAX_MS = 30_000

export interface StandaloneIdentityDeps {
  getIdentity(): Promise<{ userId: string }>
  /** The standalone socket's connected edges. Returns the unsubscribe. */
  onConnected(listener: () => void): () => void
  /** Every failed lookup, so a broken identity route is surfaced, not swallowed. */
  onFailure(error: unknown): void
}

export interface StandaloneIdentity {
  userId: Readonly<Ref<string | null>>
  stop(): void
}

export function resolveStandaloneIdentity(
  deps: StandaloneIdentityDeps
): StandaloneIdentity {
  const userId = ref<string | null>(null)
  let inFlight = false
  let stopped = false
  let failures = 0
  let retryNotBefore = 0
  let deferredRetry: ReturnType<typeof setTimeout> | null = null

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
          STANDALONE_IDENTITY_RETRY_BASE_MS * 2 ** (failures - 1),
          STANDALONE_IDENTITY_RETRY_MAX_MS
        )
      deps.onFailure(error)
    } finally {
      inFlight = false
    }
  }

  function onConnected(): void {
    if (stopped || inFlight || userId.value !== null) return
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
