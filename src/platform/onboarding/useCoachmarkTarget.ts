import { autoUpdate, flip, offset, shift, useFloating } from '@floating-ui/vue'
import type { Middleware, Placement, Rect } from '@floating-ui/vue'
import { computed, ref, watch, watchEffect } from 'vue'
import type { Ref } from 'vue'

import { CARD_GAP, VIEWPORT_MARGIN, topSafeInset } from './coachmarkLayout'
import { elementsFor, isLaidOut } from './coachmarkRegistry'
import type { CoachPlacement, CoachStep } from './onboardingTours'

// A deferred target animates in via CSS transform, which neither scroll nor
// resize events report; poll each frame until its rect stops changing for this
// long, then fall back to the cheaper scroll/resize listeners.
const MOTION_SETTLE_MS = 250

// Maps a step's placement to a Floating UI placement. `auto` starts on the right
// and flips to fit; `center` has no target, so it never reaches here.
const PLACEMENT: Record<
  Exclude<CoachPlacement, 'auto' | 'center'>,
  Placement
> = {
  left: 'left-start',
  right: 'right-start',
  leftCenter: 'left',
  bottom: 'bottom'
}

function floatingPlacement(step: CoachStep | null): Placement {
  const placement = step?.placement
  if (!placement || placement === 'auto' || placement === 'center')
    return 'right-start'
  return PLACEMENT[placement]
}

// Surfaces the measured target rect on each reposition so the spotlight can trace it.
const captureReference: Middleware = {
  name: 'captureReference',
  fn: (state) => ({ data: { rect: state.rects.reference } })
}

function middleware(step: CoachStep | null): Middleware[] {
  const list: Middleware[] = [offset(CARD_GAP)]
  if (!step?.placement || step.placement === 'auto') list.push(flip())
  // crossAxis keeps vertically-centred placements (leftCenter) on-screen too —
  // shift only guards the main axis by default. topSafeInset keeps the card off
  // the top bar; the other edges use the standard viewport margin.
  list.push(
    shift({
      crossAxis: true,
      padding: {
        top: topSafeInset(),
        left: VIEWPORT_MARGIN,
        right: VIEWPORT_MARGIN,
        bottom: CARD_GAP
      }
    }),
    captureReference
  )
  return list
}

/**
 * Locates a coach step's target in the reactive registry and positions the card
 * beside it with Floating UI: `offset`/`flip`/`shift` place the card and keep it
 * on-screen. `autoUpdate` follows the target through scroll and resize; while a
 * deferred target is still animating into place it also polls each frame, then
 * stops once the rect settles. The `captureReference` middleware surfaces the
 * live target rect for the spotlight to trace.
 */
export function useCoachmarkTarget(
  step: Ref<CoachStep | null>,
  cardRef: Ref<HTMLElement | null>
) {
  const candidateEls = computed<readonly HTMLElement[]>(() => {
    const id = step.value?.coachId
    return id ? elementsFor(id) : []
  })

  // The first laid-out candidate; skips a registered-but-hidden target (e.g. v-show).
  const targetEl = computed<HTMLElement | null>(
    () => candidateEls.value.find(isLaidOut) ?? null
  )

  const { floatingStyles, middlewareData, isPositioned, update } = useFloating(
    targetEl,
    cardRef,
    {
      strategy: 'fixed',
      transform: false,
      placement: () => floatingPlacement(step.value),
      middleware: () => middleware(step.value)
    }
  )

  const targetRect = computed<DOMRect | null>(() => {
    const data = middlewareData.value.captureReference as
      | { rect: Rect }
      | undefined
    const rect = data?.rect
    if (!rect || rect.width === 0) return null
    return new DOMRect(rect.x, rect.y, rect.width, rect.height)
  })

  // Poll every frame only while a deferred target settles in; a transform
  // animation can't be observed any other way, but once the rect stops moving
  // there is nothing to poll for.
  const trackMotion = ref(false)
  const rectKey = computed(() => {
    const r = targetRect.value
    return r ? `${r.x},${r.y},${r.width},${r.height}` : ''
  })

  watch(
    () => step.value,
    (s) => {
      trackMotion.value = !!s?.deferTarget
    },
    { immediate: true }
  )

  watch(rectKey, (_key, _prev, onCleanup) => {
    if (!trackMotion.value) return
    const timer = setTimeout(() => {
      trackMotion.value = false
    }, MOTION_SETTLE_MS)
    onCleanup(() => clearTimeout(timer))
  })

  watchEffect((onCleanup) => {
    const reference = targetEl.value
    const floating = cardRef.value
    if (!reference || !floating) return
    onCleanup(
      autoUpdate(reference, floating, update, {
        animationFrame: trackMotion.value
      })
    )
  })

  return { targetEl, targetRect, floatingStyles, isPositioned }
}
