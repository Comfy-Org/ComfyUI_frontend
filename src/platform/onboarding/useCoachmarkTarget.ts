import { autoUpdate, flip, offset, shift, useFloating } from '@floating-ui/vue'
import type {
  Middleware,
  Placement,
  Rect,
  VirtualElement
} from '@floating-ui/vue'
import { useEventListener, useRafFn } from '@vueuse/core'
import { computed, ref, shallowRef, toValue, watch, watchEffect } from 'vue'
import type { MaybeRefOrGetter, Ref } from 'vue'

import { CARD_GAP, VIEWPORT_MARGIN, topSafeInset } from './coachmarkLayout'
import { coachmarkElements, isLaidOut } from './coachmarkRegistry'
import type { CoachTarget } from './coachmarkRegistry'
import type { CoachPlacement, CoachStep } from './onboardingTours'

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

function floatingPlacement(step: CoachStep | null): Placement {
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

function middleware(step: CoachStep | null, topInset: number): Middleware[] {
  const list: Middleware[] = [offset(CARD_GAP)]
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
 * Locates a step's target in the registry and positions the card beside it with
 * Floating UI, following the target until its rect settles.
 */
export function useCoachmarkTarget(
  step: MaybeRefOrGetter<CoachStep | null>,
  cardRef: Ref<HTMLElement | null>
) {
  const candidateEls = computed<readonly CoachTarget[]>(() => {
    const id = toValue(step)?.coachId
    return id ? coachmarkElements(id) : []
  })

  const targetEl = computed<CoachTarget | null>(
    () => candidateEls.value.find(isLaidOut) ?? null
  )

  const isVirtualTarget = computed(
    () => !!targetEl.value && !(targetEl.value instanceof Element)
  )

  // The top bar's height only changes on resize, so read it once and refresh
  // then — Floating UI re-runs the middleware every frame while tracking motion.
  const topInset = ref(topSafeInset())
  useEventListener('resize', () => {
    topInset.value = topSafeInset()
  })

  /**
   * A virtual target follows a camera that reports through no DOM event, so one
   * loop samples it per frame and everything downstream reads that one sample —
   * spotlight and card positioned from different samples drift apart on screen.
   */
  const sampledRect = shallowRef(new DOMRect())
  const sampledTarget: VirtualElement = {
    getBoundingClientRect: () => sampledRect.value
  }
  const reference = computed<CoachTarget | null>(() =>
    isVirtualTarget.value ? sampledTarget : targetEl.value
  )

  const { floatingStyles, middlewareData, isPositioned, update } = useFloating(
    reference,
    cardRef,
    {
      strategy: 'fixed',
      transform: false,
      placement: () => floatingPlacement(toValue(step)),
      middleware: () => middleware(toValue(step), topInset.value)
    }
  )

  const { pause: pauseSampling, resume: resumeSampling } = useRafFn(
    () => {
      const el = targetEl.value
      if (!el) return
      const { x, y, width, height } = el.getBoundingClientRect()
      sampledRect.value = new DOMRect(x, y, width, height)
      void update()
    },
    { immediate: false }
  )
  watchEffect(() =>
    isVirtualTarget.value ? resumeSampling() : pauseSampling()
  )

  const targetRect = computed<DOMRect | null>(() => {
    const data = middlewareData.value.captureReference as
      | { rect: Rect }
      | undefined
    const rect = data?.rect
    if (!rect || rect.width === 0) return null
    return new DOMRect(rect.x, rect.y, rect.width, rect.height)
  })

  const trackMotion = ref(false)
  const rectKey = computed(() => {
    const r = targetRect.value
    return r ? `${r.x},${r.y},${r.width},${r.height}` : ''
  })

  watch(
    () => toValue(step),
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
    const anchor = reference.value
    const floating = cardRef.value
    if (!anchor || !floating) return
    onCleanup(
      autoUpdate(anchor, floating, update, {
        animationFrame: trackMotion.value
      })
    )
  })

  return { targetEl, targetRect, isVirtualTarget, floatingStyles, isPositioned }
}
