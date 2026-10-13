import { readonly, ref } from 'vue'
import type { Ref } from 'vue'

const RETRY_BASE_MS = 1_000
const RETRY_MAX_MS = 30_000

export interface AgentIdentityDeps {
  getIdentity(): Promise<{ userId: string }>
  /** The agent socket's connected edges. Returns the unsubscribe. */
  onConnected(listener: () => void): () => void
  onFailure(error: unknown): void
}

export interface ResolvedAgentIdentity {
  /** Forgets the identity and looks it up again, discarding a lookup in flight. */
  reset(): void
  userId: Readonly<Ref<string | null>>
  stop(): void
}

/**
 * The user id the agent authenticated this client as, which every canvas op
 * must carry as its actor. A failed lookup retries on its own with backoff;
 * a socket that connects again retries it at once.
 */
export function resolveAgentIdentity(
  deps: AgentIdentityDeps
): ResolvedAgentIdentity {
  const userId = ref<string | null>(null)
  let inFlight = false
  let stopped = false
  let failures = 0
  let retryTimer: ReturnType<typeof setTimeout> | null = null
  let generation = 0

  function cancelRetry(): void {
    if (retryTimer === null) return
    clearTimeout(retryTimer)
    retryTimer = null
  }

  function scheduleRetry(): void {
    if (stopped) return
    const wait = Math.min(RETRY_BASE_MS * 2 ** (failures - 1), RETRY_MAX_MS)
    retryTimer = setTimeout(() => {
      retryTimer = null
      void attempt()
    }, wait)
  }

  async function attempt(): Promise<void> {
    if (stopped || inFlight || userId.value !== null) return
    cancelRetry()
    inFlight = true
    const started = generation
    try {
      const identity = await deps.getIdentity()
      if (started === generation) userId.value = identity.userId
    } catch (error) {
      if (started !== generation) return
      failures += 1
      deps.onFailure(error)
      scheduleRetry()
    } finally {
      if (started === generation) inFlight = false
    }
  }

  function onConnected(): void {
    if (retryTimer !== null) void attempt()
  }

  const stopConnected = deps.onConnected(onConnected)
  void attempt()

  return {
    userId: readonly(userId),
    reset() {
      generation += 1
      userId.value = null
      failures = 0
      inFlight = false
      cancelRetry()
      void attempt()
    },
    stop() {
      stopped = true
      stopConnected()
      cancelRetry()
    }
  }
}
