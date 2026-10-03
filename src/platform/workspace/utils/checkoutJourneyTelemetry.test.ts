import type { CheckoutJourneyPhaseEvent } from '@comfyorg/account-core/billing'
import { assert, beforeEach, describe, expect, it, vi } from 'vitest'

import { useTelemetry } from '@/platform/telemetry'
import {
  bindOperationToCheckoutJourney,
  clearCheckoutJourney,
  resolveCheckoutJourney
} from '@/platform/workspace/utils/checkoutJourney'
import type { CheckoutJourneyRecord } from '@/platform/workspace/utils/checkoutJourney'

import {
  handOffCheckoutJourney,
  reportCheckoutJourneyExit,
  trackCheckoutJourneyPhase
} from './checkoutJourneyTelemetry'

vi.mock(import('@/platform/telemetry'))

function enterJourney(): CheckoutJourneyRecord {
  const resolved = resolveCheckoutJourney({
    actorUid: 'user-1',
    workspaceId: 'ws-1',
    entryFlow: 'topup',
    entrySource: 'settings_billing',
    assignment: { status: 'unavailable' }
  })
  assert(resolved.status === 'active')
  return resolved.record
}

function abandonedEvents() {
  return vi
    .mocked(useTelemetry()!.trackCheckoutJourneyEvent)
    .mock.calls.map(([event]) => event)
    .filter((event) => event.phase === 'abandoned')
}

const ENTERED: CheckoutJourneyPhaseEvent = { phase: 'entered' }
const PREVIEW_READY: CheckoutJourneyPhaseEvent = { phase: 'preview_ready' }
const SUBMITTED: CheckoutJourneyPhaseEvent = { phase: 'submitted' }

beforeEach(() => {
  vi.mocked(useTelemetry()!.trackCheckoutJourneyEvent).mockClear()
  sessionStorage.clear()
  clearCheckoutJourney()
})

describe('reportCheckoutJourneyExit', () => {
  function enterThenQuote(journey: CheckoutJourneyRecord) {
    trackCheckoutJourneyPhase(journey, ENTERED)
    trackCheckoutJourneyPhase(journey, PREVIEW_READY)
  }

  it.for([
    {
      exit: 'dialog_close',
      lastPhase: 'entered',
      reach: (journey: CheckoutJourneyRecord) =>
        trackCheckoutJourneyPhase(journey, ENTERED)
    },
    { exit: 'dialog_close', lastPhase: 'preview_ready', reach: enterThenQuote },
    {
      exit: 'dialog_close',
      lastPhase: 'submitted',
      reach: (journey: CheckoutJourneyRecord) => {
        enterThenQuote(journey)
        trackCheckoutJourneyPhase(journey, SUBMITTED)
      }
    },
    { exit: 'page_exit', lastPhase: 'preview_ready', reach: enterThenQuote }
  ] as const)(
    'reports a $exit after $lastPhase on a journey with no operation',
    ({ exit, lastPhase, reach }) => {
      const journey = enterJourney()
      reach(journey)

      reportCheckoutJourneyExit(exit)

      expect(abandonedEvents()).toEqual([
        expect.objectContaining({
          checkout_journey_id: journey.journey_id,
          entry_flow: 'topup',
          phase: 'abandoned',
          last_phase: lastPhase,
          exit
        })
      ])
    }
  )

  it('reports nothing once an operation is bound to the journey', () => {
    const journey = enterJourney()
    trackCheckoutJourneyPhase(journey, ENTERED)
    const linked = bindOperationToCheckoutJourney('op-1')
    assert.exists(linked)
    trackCheckoutJourneyPhase(linked, {
      phase: 'operation_linked',
      billing_op_id: 'op-1'
    })

    reportCheckoutJourneyExit('dialog_close')
    reportCheckoutJourneyExit('page_exit')

    expect(abandonedEvents()).toEqual([])
  })

  it('reports one exit when the page goes away after the dialog closed', () => {
    const journey = enterJourney()
    trackCheckoutJourneyPhase(journey, ENTERED)

    reportCheckoutJourneyExit('dialog_close')
    reportCheckoutJourneyExit('page_exit')

    expect(abandonedEvents().map((event) => event.exit)).toEqual([
      'dialog_close'
    ])
  })

  it('reports a reopened journey again only after it made new progress', () => {
    const journey = enterJourney()
    trackCheckoutJourneyPhase(journey, ENTERED)
    reportCheckoutJourneyExit('dialog_close')

    reportCheckoutJourneyExit('dialog_close')
    trackCheckoutJourneyPhase(journey, PREVIEW_READY)
    reportCheckoutJourneyExit('dialog_close')

    expect(abandonedEvents().map((event) => event.last_phase)).toEqual([
      'entered',
      'preview_ready'
    ])
  })

  it('reports nothing for a journey handed to the hosted checkout', () => {
    const journey = enterJourney()
    trackCheckoutJourneyPhase(journey, ENTERED)

    handOffCheckoutJourney()
    reportCheckoutJourneyExit('dialog_close')

    expect(abandonedEvents()).toEqual([])
  })

  it('reports nothing for a journey this tab reported no phase of', () => {
    enterJourney()

    reportCheckoutJourneyExit('dialog_close')

    expect(abandonedEvents()).toEqual([])
  })

  it('reports nothing when the tab has no active journey', () => {
    const journey = enterJourney()
    trackCheckoutJourneyPhase(journey, ENTERED)
    clearCheckoutJourney()

    reportCheckoutJourneyExit('page_exit')

    expect(abandonedEvents()).toEqual([])
  })
})
