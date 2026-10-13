import { readonly, ref } from 'vue'
import type { Ref } from 'vue'

const RETRY_BASE_MS = 1_000
const RETRY_MAX_MS = 30_000

interface AgentIdentityDeps {
  getIdentity(): Promise<{ userId: string }>
  onSocketOpen(listener: () => void): () => void
  isRetryable(error: unknown): boolean
  onFailure(error: unknown): void
}

/** Outcome of the identity lookup; `rejected` holds until `reset()`. */
export type AgentIdentityState =
  | { status: 'pending' }
  | { status: 'resolved'; userId: string }
  | { status: 'rejected' }

interface ResolvedAgentIdentity {
  reset(): void
  state: Readonly<Ref<AgentIdentityState>>
  stop(): void
}

export function resolveAgentIdentity(
  deps: AgentIdentityDeps
): ResolvedAgentIdentity {
  const state = ref<AgentIdentityState>({ status: 'pending' })
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
    if (stopped || inFlight || state.value.status !== 'pending') return
    cancelRetry()
    inFlight = true
    const started = generation
    try {
      const identity = await deps.getIdentity()
      if (started === generation)
        state.value = { status: 'resolved', userId: identity.userId }
    } catch (error) {
      if (started !== generation) return
      failures += 1
      deps.onFailure(error)
      if (deps.isRetryable(error)) scheduleRetry()
      else state.value = { status: 'rejected' }
    } finally {
      if (started === generation) inFlight = false
    }
  }

  function retryNow(): void {
    if (retryTimer !== null) void attempt()
  }

  const stopListening = deps.onSocketOpen(retryNow)
  void attempt()

  return {
    state: readonly(state),
    reset() {
      generation += 1
      state.value = { status: 'pending' }
      failures = 0
      inFlight = false
      cancelRetry()
      void attempt()
    },
    stop() {
      stopped = true
      generation += 1
      stopListening()
      cancelRetry()
    }
  }
}
