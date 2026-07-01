import { shallowReactive } from 'vue'

import type { CoachId } from './onboardingTours'

const EMPTY: readonly HTMLElement[] = []

/** Laid out — a registered target that is currently visible and has a size. */
export function isLaidOut(el: HTMLElement): boolean {
  const r = el.getBoundingClientRect()
  return r.width > 0 && r.height > 0
}

/**
 * Live map of coach ids to the elements currently mounted for them, populated
 * by the `v-coachmark` directive. Reactive, so the tour overlay is *told* when
 * a target mounts, unmounts or swaps — no DOM querying or MutationObservers.
 * An id can resolve to several elements (e.g. responsive variants); the overlay
 * picks the first laid-out one.
 */
const registry = shallowReactive(new Map<CoachId, readonly HTMLElement[]>())

export function registerCoachmark(id: CoachId, el: HTMLElement) {
  registry.set(id, [...(registry.get(id) ?? EMPTY), el])
}

export function unregisterCoachmark(id: CoachId, el: HTMLElement) {
  const next = (registry.get(id) ?? EMPTY).filter((entry) => entry !== el)
  if (next.length) registry.set(id, next)
  else registry.delete(id)
}

export function coachmarkElements(id: CoachId): readonly HTMLElement[] {
  return registry.get(id) ?? EMPTY
}

/** All elements registered for an id (or any of several ids). */
export function elementsFor(id: CoachId | CoachId[]): readonly HTMLElement[] {
  if (!Array.isArray(id)) return coachmarkElements(id)
  return id.flatMap((coachId) => [...coachmarkElements(coachId)])
}

/** Whether a laid-out (visible, non-zero-size) element for the id is mounted. */
export function targetMounted(id: CoachId | CoachId[]): boolean {
  return elementsFor(id).some(isLaidOut)
}

/**
 * Resolve once a laid-out element for the id exists; false on timeout or abort.
 * Polls per frame so a target that registers before it lays out (e.g. a panel
 * that animates open from zero size) still resolves only when it's measurable.
 */
export function waitForTarget(
  id: CoachId | CoachId[],
  signal: AbortSignal,
  timeoutMs: number
): Promise<boolean> {
  if (targetMounted(id)) return Promise.resolve(true)
  // An already-aborted signal never fires 'abort', so resolve up front.
  if (signal.aborted) return Promise.resolve(false)
  return new Promise((resolve) => {
    let done = false
    let frame = 0
    function finish(found: boolean) {
      if (done) return
      done = true
      cancelAnimationFrame(frame)
      clearTimeout(timer)
      signal.removeEventListener('abort', onAbort)
      resolve(found)
    }
    function onAbort() {
      finish(false)
    }
    function poll() {
      if (targetMounted(id)) finish(true)
      else frame = requestAnimationFrame(poll)
    }
    const timer = setTimeout(() => finish(false), timeoutMs)
    signal.addEventListener('abort', onAbort)
    frame = requestAnimationFrame(poll)
  })
}

/** Drops every registered element; for resetting shared state between tests. */
export function clearCoachmarks() {
  registry.clear()
}
