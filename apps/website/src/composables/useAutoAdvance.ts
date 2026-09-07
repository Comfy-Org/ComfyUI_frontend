import { onScopeDispose, toValue, watch } from 'vue'
import type { MaybeRefOrGetter } from 'vue'

import { prefersReducedMotion } from './useReducedMotion'

type AutoAdvanceOptions = {
  /** Advance only while the owning section is on screen. */
  onScreen: MaybeRefOrGetter<boolean>
  /** While true (e.g. the visitor is hovering) the cycle holds in place. */
  held: MaybeRefOrGetter<boolean>
  /** Regular cadence between advances. */
  dwellMs: number
  /** Shorter fuse for `resume()`, so the cycle doesn't feel stalled coming
   * off an interaction. Defaults to the regular cadence. */
  resumeMs?: number
  onAdvance: () => void
}

/**
 * Self-running demo cycle: advance every `dwellMs` while the section is on
 * screen, holding in place while the visitor interacts (`held`). Call
 * `restart()` after a manual selection so the cycle waits a full beat before
 * moving off the visitor's choice, and `resume()` when they release the
 * controls to pick back up on the shorter fuse. Disabled entirely under
 * `prefers-reduced-motion`.
 */
export function useAutoAdvance(options: AutoAdvanceOptions): {
  restart: () => void
  resume: () => void
} {
  const { onScreen, held, dwellMs, resumeMs = dwellMs, onAdvance } = options

  let timer: ReturnType<typeof setTimeout> | undefined

  function schedule(delay: number) {
    clearTimeout(timer)
    timer = undefined
    if (!toValue(onScreen) || prefersReducedMotion()) return
    timer = setTimeout(() => {
      if (!toValue(held)) onAdvance()
      schedule(dwellMs)
    }, delay)
  }

  watch(
    () => toValue(onScreen),
    () => schedule(dwellMs),
    { immediate: true }
  )
  onScopeDispose(() => clearTimeout(timer))

  return {
    restart: () => schedule(dwellMs),
    resume: () => schedule(resumeMs)
  }
}
