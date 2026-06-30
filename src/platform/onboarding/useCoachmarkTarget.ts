import { useElementBounding, useEventListener } from '@vueuse/core'
import { computed, onScopeDispose, watch } from 'vue'
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
 * Geometry — which the registry can't provide — is tracked by `useElementBounding`
 * (resize, window scroll and element swaps), extended to scrollable ancestors by
 * the capture-phase scroll listener, with a frame-settle for transform-driven
 * open animations a ResizeObserver can't see.
 */
export function useCoachmarkTarget(step: Ref<CoachStep | null>) {
  // Elements registered for the step's id(s); reactive, drives re-measure and close detection.
  const candidateEls = computed<readonly HTMLElement[]>(() => {
    const id = step.value?.coachId
    return id ? elementsFor(id) : []
  })

  // The first laid-out candidate; skips a registered-but-hidden target (e.g. v-show).
  const targetEl = computed<HTMLElement | null>(
    () => candidateEls.value.find(isLaidOut) ?? null
  )

  // `windowScroll` off: the capture-phase listener already catches window and
  // scrollable-ancestor scrolls, so VueUse needn't double-bind window scroll.
  const { x, y, width, height, update } = useElementBounding(targetEl, {
    windowScroll: false
  })
  const targetRect = computed<DOMRect | null>(() =>
    targetEl.value && width.value > 0
      ? new DOMRect(x.value, y.value, width.value, height.value)
      : null
  )
  useEventListener(window, 'scroll', update, { capture: true, passive: true })

  // A target swap can call settle() while a prior loop runs; cancel so one re-measure per frame.
  let settleFrame: number | null = null
  onScopeDispose(() => {
    if (settleFrame !== null) cancelAnimationFrame(settleFrame)
  })

  function settle(signal: AbortSignal) {
    if (settleFrame !== null) cancelAnimationFrame(settleFrame)
    let last = ''
    let stable = 0
    let frames = 0
    function tick() {
      settleFrame = null
      if (signal.aborted) return
      update()
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
    update,
    settle,
    targetMounted,
    waitForTarget
  }
}
