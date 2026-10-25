/**
 * Whether a run is in flight, shared across the page's Vue islands.
 *
 * The playground guards every way off the page it can see: a reload, a history
 * move, a link. The header is a separate island and switching workspace is
 * none of those, so the run kept going against a session that no longer
 * belonged to it. This is the one fact the header needs, and the one call that
 * stops the run, so it can ask before it switches.
 */
import { readonly, shallowRef } from 'vue'

const inFlight = shallowRef(false)
let stop: (() => void) | undefined

export const workshopRunInFlight = readonly(inFlight)

/** The playground says a run is going, and how to stop it. */
export function reportWorkshopRun(cancel: (() => void) | undefined): void {
  inFlight.value = cancel !== undefined
  stop = cancel
}

export function cancelWorkshopRun(): void {
  stop?.()
}
