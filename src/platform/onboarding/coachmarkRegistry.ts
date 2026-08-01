import { shallowReactive, watch } from 'vue'

import type { CoachId } from './onboardingTours'

/** Reports its own rect: a canvas node moves without firing any DOM event. */
export interface RectTarget {
  getRect: () => DOMRect | null
  onMove: (notify: () => void) => () => void
  dispose?: () => void
}

export type CoachTarget = HTMLElement | RectTarget

export function isRectTarget(target: CoachTarget): target is RectTarget {
  return !(target instanceof HTMLElement)
}

const EMPTY: readonly CoachTarget[] = []

/** A target's rect, once it is rendered with a size. */
export function laidOutRect(target: CoachTarget): DOMRect | null {
  const rect = isRectTarget(target)
    ? target.getRect()
    : target.getBoundingClientRect()
  if (!rect || rect.width <= 0 || rect.height <= 0) return null
  return rect
}

// An id can map to several elements (e.g. responsive variants); consumers pick
// the first laid-out one.
const registry = shallowReactive(new Map<CoachId, readonly CoachTarget[]>())

export function registerCoachmark(id: CoachId, target: CoachTarget) {
  registry.set(id, [...(registry.get(id) ?? EMPTY), target])
}

export function unregisterCoachmark(id: CoachId, target: CoachTarget) {
  const next = (registry.get(id) ?? EMPTY).filter((entry) => entry !== target)
  if (next.length) registry.set(id, next)
  else registry.delete(id)
}

export function coachmarkElements(id: CoachId): readonly CoachTarget[] {
  return registry.get(id) ?? EMPTY
}

export function targetMounted(id: CoachId): boolean {
  return coachmarkElements(id).some((target) => !!laidOutRect(target))
}

// Frequent enough to feel immediate, cheap enough not to measure every frame.
export const PLACEMENT_POLL_MS = 100

/** Resolves once a laid-out target for the id exists; false on timeout or abort. */
export function waitForTarget(
  id: CoachId,
  signal: AbortSignal,
  timeoutMs: number
): Promise<boolean> {
  if (targetMounted(id)) return Promise.resolve(true)
  // An already-aborted signal never fires 'abort', so resolve up front.
  if (signal.aborted) return Promise.resolve(false)
  return new Promise((resolve) => {
    let done = false
    let poll: ReturnType<typeof setTimeout>
    function finish(found: boolean) {
      if (done) return
      done = true
      stopWatch()
      clearTimeout(poll)
      clearTimeout(timer)
      signal.removeEventListener('abort', onAbort)
      resolve(found)
    }
    function onAbort() {
      finish(false)
    }
    // Placement is a measurement nothing reports, so it is sampled — but only
    // while a candidate is registered, which is reactive.
    function samplePlacement() {
      if (targetMounted(id)) finish(true)
      else if (coachmarkElements(id).length)
        poll = setTimeout(samplePlacement, PLACEMENT_POLL_MS)
    }
    const stopWatch = watch(
      () => coachmarkElements(id).length,
      () => {
        clearTimeout(poll)
        samplePlacement()
      },
      { flush: 'post' }
    )
    const timer = setTimeout(() => finish(false), timeoutMs)
    signal.addEventListener('abort', onAbort)
    samplePlacement()
  })
}

/** Resets shared state between tests. */
export function clearCoachmarks() {
  registry.clear()
}
