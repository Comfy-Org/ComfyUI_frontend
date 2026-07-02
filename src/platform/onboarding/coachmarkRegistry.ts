import { shallowReactive } from 'vue'

import type { CoachId } from './onboardingTours'

const EMPTY: readonly HTMLElement[] = []

/** Laid out — a registered target that is currently visible and has a size. */
export function isLaidOut(el: HTMLElement): boolean {
  const r = el.getBoundingClientRect()
  return r.width > 0 && r.height > 0
}

// An id can map to several elements (e.g. responsive variants); consumers pick
// the first laid-out one.
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

export function elementsFor(id: CoachId | CoachId[]): readonly HTMLElement[] {
  if (!Array.isArray(id)) return coachmarkElements(id)
  return id.flatMap((coachId) => [...coachmarkElements(coachId)])
}

export function targetMounted(id: CoachId | CoachId[]): boolean {
  return elementsFor(id).some(isLaidOut)
}

/** Resolves once a laid-out element for the id exists; false on timeout or abort. */
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

/** Resets shared state between tests. */
export function clearCoachmarks() {
  registry.clear()
}
