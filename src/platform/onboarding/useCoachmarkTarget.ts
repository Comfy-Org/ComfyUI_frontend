import { autoUpdate, flip, offset, shift, useFloating } from '@floating-ui/vue'
import type { Middleware, Placement, Rect } from '@floating-ui/vue'
import { computed } from 'vue'
import type { Ref } from 'vue'

import { CARD_GAP, TOP_SAFE_INSET, VIEWPORT_MARGIN } from './coachmarkLayout'
import { elementsFor, isLaidOut } from './coachmarkRegistry'
import type { CoachPlacement, CoachStep } from './onboardingTours'

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

// Keeps the card off the top bar and clear of the viewport edges.
const SHIFT_PADDING = {
  top: TOP_SAFE_INSET,
  left: VIEWPORT_MARGIN,
  right: VIEWPORT_MARGIN,
  bottom: CARD_GAP
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
  // shift only guards the main axis by default.
  list.push(
    shift({ crossAxis: true, padding: SHIFT_PADDING }),
    captureReference
  )
  return list
}

/**
 * Locates a coach step's target in the reactive registry and positions the card
 * beside it with Floating UI: `offset`/`flip`/`shift` place the card and keep it
 * on-screen, while `autoUpdate` follows the target through scroll, resize and —
 * for deferred targets that animate in — every frame. The `captureReference`
 * middleware surfaces the live target rect for the spotlight to trace.
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

  const { floatingStyles, middlewareData, isPositioned } = useFloating(
    targetEl,
    cardRef,
    {
      strategy: 'fixed',
      transform: false,
      placement: () => floatingPlacement(step.value),
      middleware: () => middleware(step.value),
      whileElementsMounted: (reference, floating, update) =>
        autoUpdate(reference, floating, update, {
          animationFrame: step.value?.deferTarget ?? false
        })
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

  return { targetEl, targetRect, floatingStyles, isPositioned }
}
