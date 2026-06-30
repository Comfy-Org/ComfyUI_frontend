import { useEventListener } from '@vueuse/core'
import { computed, onScopeDispose, ref, shallowRef, watch } from 'vue'
import type { Ref } from 'vue'

import { coachmarkElements } from './coachmarkRegistry'
import type { CoachId, CoachStep } from './onboardingTours'

// A deferred target animates in; trust the rect only after STABLE steady frames, capped at MAX.
const SETTLE_STABLE_FRAMES = 10
const SETTLE_MAX_FRAMES = 30

function rectKey(r: DOMRect | null): string {
  return r ? `${r.x},${r.y},${r.width},${r.height}` : 'null'
}

/** Laid out — skips a registered target that is hidden (e.g. by v-show). */
function isLaidOut(el: HTMLElement): boolean {
  const r = el.getBoundingClientRect()
  return r.width > 0 && r.height > 0
}

function elementsFor(id: CoachId | CoachId[]): readonly HTMLElement[] {
  const ids = Array.isArray(id) ? id : [id]
  return ids.flatMap((coachId) => [...coachmarkElements(coachId)])
}

/**
 * Tracks the on-screen rect of a coach step's target. The element itself comes
 * from the reactive registry (the `v-coachmark` directive registers it), so
 * mounts, unmounts and swaps arrive as reactivity rather than DOM observation.
 * Geometry — which the registry can't provide — is still measured here, kept
 * glued through resizes, scrolls and the target's own size changes, with a
 * frame-settle for transform-driven open animations a ResizeObserver can't see.
 */
export function useCoachmarkTarget(step: Ref<CoachStep | null>) {
  const targetRect = ref<DOMRect | null>(null)
  // Cached so per-event consumers (focus trap, click guard) don't re-resolve.
  const targetEl = shallowRef<HTMLElement | null>(null)

  // Elements registered for the step's id(s); reactive, drives re-measure and close detection.
  const candidateEls = computed<readonly HTMLElement[]>(() => {
    const id = step.value?.coachId
    return id ? elementsFor(id) : []
  })

  function firstVisible(els: readonly HTMLElement[]): HTMLElement | null {
    return els.find(isLaidOut) ?? null
  }

  function measure() {
    const id = step.value?.coachId
    if (!id) {
      targetEl.value = null
      targetRect.value = null
      return
    }
    const el = firstVisible(elementsFor(id))
    targetEl.value = el
    targetRect.value = el?.getBoundingClientRect() ?? null
  }

  // Coalesce resize/scroll/observer triggers into one measure per frame (each forces layout).
  let measureFrame: number | null = null
  let settleFrame: number | null = null
  function scheduleMeasure() {
    if (measureFrame !== null || !step.value) return
    measureFrame = requestAnimationFrame(() => {
      measureFrame = null
      measure()
    })
  }

  useEventListener(window, 'resize', scheduleMeasure)
  useEventListener(window, 'scroll', scheduleMeasure, {
    capture: true,
    passive: true
  })
  let resizeObserver: ResizeObserver | null = null
  watch(targetEl, (el) => {
    resizeObserver?.disconnect()
    resizeObserver = null
    if (!el) return
    resizeObserver = new ResizeObserver(scheduleMeasure)
    resizeObserver.observe(el)
  })
  onScopeDispose(() => {
    resizeObserver?.disconnect()
    if (measureFrame !== null) cancelAnimationFrame(measureFrame)
    if (settleFrame !== null) cancelAnimationFrame(settleFrame)
  })

  // A target swap can call settle() while a prior loop runs; cancel so one re-measure per frame.
  function settle(signal: AbortSignal) {
    if (settleFrame !== null) cancelAnimationFrame(settleFrame)
    let last = ''
    let stable = 0
    let frames = 0
    function tick() {
      settleFrame = null
      if (signal.aborted) return
      measure()
      const key = rectKey(targetRect.value)
      if (key === last) {
        stable++
      } else {
        stable = 0
        last = key
      }
      if (stable >= SETTLE_STABLE_FRAMES || ++frames >= SETTLE_MAX_FRAMES)
        return
      settleFrame = requestAnimationFrame(tick)
    }
    settleFrame = requestAnimationFrame(tick)
  }

  /** Whether an element for the id is mounted (regardless of current size). */
  function targetMounted(id: CoachId | CoachId[]): boolean {
    return elementsFor(id).length > 0
  }

  /** Resolve once an element for the id mounts; false on timeout or abort. */
  function waitForTarget(
    id: CoachId | CoachId[],
    signal: AbortSignal,
    timeoutMs: number
  ): Promise<boolean> {
    if (targetMounted(id)) return Promise.resolve(true)
    return new Promise((resolve) => {
      let done = false
      function finish(found: boolean) {
        if (done) return
        done = true
        stop()
        clearTimeout(timer)
        signal.removeEventListener('abort', onAbort)
        resolve(found)
      }
      function onAbort() {
        finish(false)
      }
      const stop = watch(
        () => elementsFor(id).length,
        (count) => {
          if (count > 0) finish(true)
        }
      )
      const timer = setTimeout(() => finish(false), timeoutMs)
      signal.addEventListener('abort', onAbort)
    })
  }

  return {
    targetRect,
    targetEl,
    candidateEls,
    measure,
    settle,
    targetMounted,
    waitForTarget
  }
}
