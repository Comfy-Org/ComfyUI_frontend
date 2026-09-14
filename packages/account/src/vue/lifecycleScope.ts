import { effectScope } from 'vue'
import type { EffectScope } from 'vue'

/**
 * A detached {@link effectScope} for a module singleton that must own its
 * watchers' lifetime rather than borrow it from whichever component reaches it
 * first. `start` installs the scope once and latches; `stop` disposes it and
 * reopens the latch so `start` may be called again. `start` is synchronous and
 * detects no failure of its own — recovering from a failed install is the
 * caller's responsibility: `.catch` the failure and call `stop` to reopen the
 * latch before the next `start`.
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
