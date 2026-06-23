import { shallowReactive } from 'vue'

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
