import { useElementBounding, useEventListener } from '@vueuse/core'
import { computed, nextTick, onScopeDispose, watch } from 'vue'
import type { Ref } from 'vue'

import { elementsFor } from './coachmarkRegistry'
import type { CoachStep } from './onboardingTours'

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

/**
 * Tracks the on-screen rect of a coach step's target. The element comes from the
 * reactive registry (the `v-coachmark` directive), so mounts/unmounts/swaps arrive
 * as reactivity rather than DOM observation; geometry is measured by
 * `useElementBounding` plus the scroll listener and settle loop below. Re-measures
 * itself on any change, so callers only read `targetRect`/`targetEl`.
 */
export function useCoachmarkTarget(step: Ref<CoachStep | null>) {
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

  let settleFrame: number | null = null
  function cancelSettle() {
    if (settleFrame !== null) cancelAnimationFrame(settleFrame)
    settleFrame = null
  }
  onScopeDispose(cancelSettle)

  // Re-measure each frame until the rect holds steady for the stable window,
  // capped so a never-settling rect still stops; cancels any prior loop first.
  function settle() {
    cancelSettle()
    let last = ''
    let stable = 0
    let frames = 0
    function tick() {
      settleFrame = null
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

  // Re-measure when the step changes or its target mounts/swaps; a deferred
  // target additionally settles through its open animation.
  watch([step, candidateEls], () => {
    cancelSettle()
    void nextTick(() => {
      update()
      if (step.value?.deferTarget) settle()
    })
  })

  return { targetRect, targetEl }
}
