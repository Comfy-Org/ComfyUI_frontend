import { autoUpdate, flip, offset, shift, useFloating } from '@floating-ui/vue'
import type {
  Middleware,
  Placement,
  Rect,
  ReferenceElement
} from '@floating-ui/vue'
import { refDebounced, useEventListener } from '@vueuse/core'
import { computed, ref, toValue, watchEffect } from 'vue'
import type { MaybeRefOrGetter, Ref } from 'vue'

import {
  CARD_GAP,
  CURSOR_GAP,
  VIEWPORT_MARGIN,
  topSafeInset
} from './coachmarkLayout'
import {
  coachmarkElements,
  isRectTarget,
  laidOutRect
} from './coachmarkRegistry'
import type { CoachTarget } from './coachmarkRegistry'
import type { CoachPlacement, SpotlightStep } from './onboardingTours'

// A target animating in via CSS transform reports through neither scroll nor
// resize events; poll each frame until its rect holds still this long.
const MOTION_SETTLE_MS = 250

const PLACEMENT: Record<
  Exclude<CoachPlacement, 'auto' | 'center'>,
  Placement
> = {
  left: 'left-start',
  right: 'right-start',
  leftCenter: 'left',
  bottom: 'bottom'
}

function floatingPlacement(step: SpotlightStep | null): Placement {
  const placement = step?.placement
  if (!placement || placement === 'auto' || placement === 'center')
    return 'right-start'
  return PLACEMENT[placement]
}

// Surfaces the measured target rect so the spotlight can trace it.
const captureReference: Middleware = {
  name: 'captureReference',
  fn: (state) => ({ data: { rect: state.rects.reference } })
}

function floatingMiddleware(
  step: SpotlightStep | null,
  topInset: number
): Middleware[] {
  const list: Middleware[] = [offset(step?.cursor ? CURSOR_GAP : CARD_GAP)]
  if (!step?.placement || step.placement === 'auto') list.push(flip())
  // shift only guards the main axis by default; crossAxis keeps vertically-
  // centred placements (leftCenter) on-screen too.
  list.push(
    shift({
      crossAxis: true,
      padding: {
        top: topInset,
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
 * A deferred target animates in under its own CSS transform, which reports
 * through neither scroll nor resize: it is still settling until its rect has
 * held still long enough for the debounced copy to catch up.
 */
export function isSettling(
  step: SpotlightStep | null,
  rect: DOMRect | null,
  settled: DOMRect | null
): boolean {
  return !!step?.deferTarget && rect !== settled
}

/**
 * Locates a step's target in the registry and positions the card beside it with
 * Floating UI, following the target until its rect settles.
 */
export function useCoachmarkTarget(
  step: MaybeRefOrGetter<SpotlightStep | null>,
  cardRef: Ref<HTMLElement | null>
) {
  const candidates = computed<readonly CoachTarget[]>(() => {
    const id = toValue(step)?.coachId
    return id ? coachmarkElements(id) : []
  })

  const anchor = computed(
    () => candidates.value.find((candidate) => laidOutRect(candidate)) ?? null
  )

  const movingAnchor = computed(() =>
    anchor.value && isRectTarget(anchor.value) ? anchor.value : null
  )

  const targetMoves = computed(() => !!movingAnchor.value)

  const reference = computed<ReferenceElement | null>(() => {
    const candidate = anchor.value
    if (!candidate) return null
    if (!isRectTarget(candidate)) return candidate
    return {
      getBoundingClientRect: () => candidate.getRect() ?? new DOMRect()
    }
  })

  // The top bar's height only changes on resize, so read it once and refresh
  // then — Floating UI re-runs the middleware every frame while tracking motion.
  const topInset = ref(topSafeInset())
  useEventListener('resize', () => {
    topInset.value = topSafeInset()
  })

  const { floatingStyles, middlewareData, isPositioned, placement, update } =
    useFloating(reference, cardRef, {
      strategy: 'fixed',
      transform: false,
      placement: () => floatingPlacement(toValue(step)),
      middleware: () => floatingMiddleware(toValue(step), topInset.value)
    })

  watchEffect((onCleanup) => {
    const candidate = movingAnchor.value
    if (!candidate) return
    onCleanup(candidate.onMove(() => void update()))
  })

  const targetRect = computed<DOMRect | null>(() => {
    const data = middlewareData.value.captureReference as
      | { rect: Rect }
      | undefined
    const rect = data?.rect
    if (!rect || rect.width === 0) return null
    return new DOMRect(rect.x, rect.y, rect.width, rect.height)
  })

  const settledRect = refDebounced(targetRect, MOTION_SETTLE_MS)
  const trackMotion = computed(() =>
    isSettling(toValue(step), targetRect.value, settledRect.value)
  )

  watchEffect((onCleanup) => {
    const element = anchor.value
    const floating = cardRef.value
    if (!element || isRectTarget(element) || !floating) return
    onCleanup(
      autoUpdate(element, floating, update, {
        animationFrame: trackMotion.value
      })
    )
  })

  /** Whether a candidate is anchored — a rect target holds no element. */
  const hasTarget = computed(() => !!anchor.value)

  return {
    hasTarget,
    targetRect,
    targetMoves,
    floatingStyles,
    isPositioned,
    placement
  }
}
