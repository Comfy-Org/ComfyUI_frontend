import { shallowReactive, watch } from 'vue'

import type { CoachId } from './onboardingTours'

/** Names an element that remounts and moves without events; the engine
 *  re-resolves it and follows it frame by frame. */
export interface SelectorTarget {
  selector: string
}

export type CoachTarget = HTMLElement | SelectorTarget

export function isSelectorTarget(
  target: CoachTarget
): target is SelectorTarget {
  return !(target instanceof HTMLElement)
}

function resolveTarget(target: CoachTarget): HTMLElement | null {
  if (!isSelectorTarget(target)) return target
  return document.querySelector<HTMLElement>(target.selector)
}

const EMPTY: readonly CoachTarget[] = []

/** The element a target names, once it is rendered with a size. */
export function laidOutElement(target: CoachTarget): HTMLElement | null {
  const element = resolveTarget(target)
  if (!element) return null
  const { width, height } = element.getBoundingClientRect()
  return width > 0 && height > 0 ? element : null
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
  return coachmarkElements(id).some((target) => !!laidOutElement(target))
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
