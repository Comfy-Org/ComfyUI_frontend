import { shallowReactive, watch } from 'vue'

import type { CoachId } from './onboardingTours'

const EMPTY: readonly HTMLElement[] = []

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

/** Whether an element for the id is mounted (regardless of current size). */
export function targetMounted(id: CoachId | CoachId[]): boolean {
  return elementsFor(id).length > 0
}

/** Resolve once an element for the id mounts; false on timeout or abort. */
export function waitForTarget(
  id: CoachId | CoachId[],
  signal: AbortSignal,
  timeoutMs: number
): Promise<boolean> {
  if (targetMounted(id)) return Promise.resolve(true)
  return new Promise((resolve) => {
    let done = false
    function finish(found: boolean) {
      if (done) return
      done = true
      stop()
      clearTimeout(timer)
      signal.removeEventListener('abort', onAbort)
      resolve(found)
    }
    function onAbort() {
      finish(false)
    }
    const stop = watch(
      () => elementsFor(id).length,
      (count) => {
        if (count > 0) finish(true)
      }
    )
    const timer = setTimeout(() => finish(false), timeoutMs)
    signal.addEventListener('abort', onAbort)
  })
}

/** Drops every registered element; for resetting shared state between tests. */
export function clearCoachmarks() {
  registry.clear()
}
