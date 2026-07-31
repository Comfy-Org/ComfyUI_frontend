import { shallowReactive, watch } from 'vue'

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

export function targetMounted(id: CoachId): boolean {
  return coachmarkElements(id).some(isLaidOut)
}

/** Resolves once a laid-out element for the id exists; false on timeout or abort. */
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
    let frame = 0
    function finish(found: boolean) {
      if (done) return
      done = true
      stopWatch()
      cancelAnimationFrame(frame)
      clearTimeout(timer)
      signal.removeEventListener('abort', onAbort)
      resolve(found)
    }
    function onAbort() {
      finish(false)
    }
    // Laid-out-ness is a layout read the registry can't observe, so it needs
    // polling — but only while a candidate exists. Registration is reactive,
    // so the watch (re)starts the poll instead of spinning every frame while
    // the target hasn't even mounted.
    function poll() {
      if (targetMounted(id)) finish(true)
      else if (coachmarkElements(id).length) frame = requestAnimationFrame(poll)
    }
    const stopWatch = watch(
      () => coachmarkElements(id).length,
      () => {
        cancelAnimationFrame(frame)
        poll()
      },
      { flush: 'post' }
    )
    const timer = setTimeout(() => finish(false), timeoutMs)
    signal.addEventListener('abort', onAbort)
    poll()
  })
}

/** Resets shared state between tests. */
export function clearCoachmarks() {
  registry.clear()
}
