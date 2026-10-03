import type {
  CheckoutExit,
  CheckoutJourneyPhase,
  CheckoutJourneyPhaseEvent
} from '@comfyorg/account-core/billing'
import { useEventListener } from '@vueuse/core'
import { onScopeDispose } from 'vue'

import { useTelemetry } from '@/platform/telemetry'
import {
  getActiveCheckoutJourney,
  toCheckoutJourneyContext
} from '@/platform/workspace/utils/checkoutJourney'
import type { CheckoutJourneyRecord } from '@/platform/workspace/utils/checkoutJourney'

type CloudCheckoutExit = Extract<CheckoutExit, 'dialog_close' | 'page_exit'>

/**
 * The last progress phase this tab reported on a journey, and whether an exit
 * or a handoff already accounts for it. Only new progress reopens it.
 */
let progress: {
  journeyId: string
  lastPhase: Exclude<CheckoutJourneyPhase, 'abandoned' | 'ended'>
  accounted: boolean
} | null = null

export function trackCheckoutJourneyPhase(
  record: CheckoutJourneyRecord,
  phase: CheckoutJourneyPhaseEvent
): void {
  if (phase.phase !== 'abandoned' && phase.phase !== 'ended') {
    progress = {
      journeyId: record.journey_id,
      lastPhase: phase.phase,
      accounted: false
    }
  }
  useTelemetry()?.trackCheckoutJourneyEvent({
    ...toCheckoutJourneyContext(record),
    ...phase
  })
}

function unaccountedProgress(journey: CheckoutJourneyRecord) {
  return progress?.journeyId === journey.journey_id && !progress.accounted
    ? progress
    : null
}

/** The journey continues on the hosted checkout, so closing this dialog is not an exit. */
export function handOffCheckoutJourney(): void {
  const journey = getActiveCheckoutJourney()
  const open = journey && unaccountedProgress(journey)
  if (open) open.accounted = true
}

/**
 * Where the customer left a journey no operation is bound to. An observation,
 * not a verdict: once an operation exists its own events own the end.
 */
export function reportCheckoutJourneyExit(exit: CloudCheckoutExit): void {
  const journey = getActiveCheckoutJourney()
  if (!journey || journey.billing_op_id !== undefined) return
  const open = unaccountedProgress(journey)
  if (!open) return
  open.accounted = true
  trackCheckoutJourneyPhase(journey, {
    phase: 'abandoned',
    last_phase: open.lastPhase,
    exit
  })
}

/** For a checkout dialog: its close, or the page going away while it is open, is an exit. */
export function useCheckoutJourneyExit(): void {
  useEventListener(window, 'pagehide', () =>
    reportCheckoutJourneyExit('page_exit')
  )
  onScopeDispose(() => reportCheckoutJourneyExit('dialog_close'))
}
