import { effectScope } from 'vue'
import type { EffectScope } from 'vue'

/**
 * A detached {@link effectScope} for a module singleton that must own its
 * watchers' lifetime rather than borrow it from whichever component reaches it
 * first. `start` installs the scope once; `stop` disposes it and reopens the
 * latch, so a failed async install can tear down and let the next caller retry.
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
