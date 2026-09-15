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
 * `start` is synchronous and returns void: it never surfaces a setup failure to
 * its caller. A `setup` that can fail launches its own promise and catches it,
 * calling `stop` from that handler to reopen the latch before a later `start`.
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
      scope = effectScope(true)
      scope.run(setup)
    },
    stop() {
      scope?.stop()
      scope = undefined
    }
  }
}
