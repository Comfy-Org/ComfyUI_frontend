import { effectScope } from 'vue'
import type { EffectScope } from 'vue'

/**
 * A detached {@link effectScope} for a module singleton that must own its
 * watchers' lifetime rather than borrow it from whichever component reaches it
 * first. `start` installs the scope once and latches; `stop` disposes it and
 * reopens the latch so `start` may be called again.
 *
 * On the server (`window` undefined) `start` is a no-op that does not latch, so
 * the client's first `start` still installs.
 *
 * `start` is synchronous. A synchronous throw from `setup` disposes the scope,
 * reopens the latch, and rethrows, so a failed install leaves no stuck latch or
 * leaked effects. Async failures are the setup's own to catch: a `setup` that
 * launches a promise catches it and calls `stop` from that handler.
 */
export interface LifecycleScope {
  start: (setup: () => void) => void
  stop: () => void
}

export function createLifecycleScope(): LifecycleScope {
  let scope: EffectScope | undefined
  return {
    start(setup) {
      if (scope || typeof window === 'undefined') return
      const created = effectScope(true)
      scope = created
      try {
        created.run(setup)
      } catch (error) {
        created.stop()
        scope = undefined
        throw error
      }
    },
    stop() {
      scope?.stop()
      scope = undefined
    }
  }
}
