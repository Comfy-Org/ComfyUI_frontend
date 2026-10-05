import { describe, expect, it } from 'vitest'

import type { CheckoutJourneyTelemetryEvent } from './checkoutJourney.js'
import {
  CHECKOUT_JOURNEY_EVENT_NAME_BY_PHASE,
  CHECKOUT_JOURNEY_SCHEMA_VERSION,
  getCheckoutJourneyTelemetryEventName,
  getCheckoutJourneyTelemetryEventPayload
} from './checkoutJourney.js'

const CONTEXT = {
  checkout_journey_id: 'journey-1',
  checkout_entered_at: '2026-10-01T00:00:00.000Z',
  assignment_status: 'unavailable',
  entry_flow: 'initial_subscription',
  entry_source: 'other',
  ui_mode: 'full_page'
} as const

const PAYLOAD_OF_CONTEXT = {
  schema_version: 1,
  checkout_journey_id: 'journey-1',
  checkout_entered_at: '2026-10-01T00:00:00.000Z',
  assignment_status: 'unavailable',
  entry_flow: 'initial_subscription',
  entry_source: 'other',
  ui_mode: 'full_page'
} as const

interface PayloadCase {
  readonly name: string
  readonly event: CheckoutJourneyTelemetryEvent
  readonly payload: Readonly<Record<string, unknown>>
}

const CASES: readonly PayloadCase[] = [
  {
    name: 'an entry carries the click-time source at the shared grain',
    event: {
      ...CONTEXT,
      phase: 'entered',
      payment_intent_source: 'subscribe_to_run'
    },
    payload: {
      ...PAYLOAD_OF_CONTEXT,
      phase: 'entered',
      payment_intent_source: 'subscribe_to_run'
    }
  },
  {
    name: 'an entry without a source carries none',
    event: { ...CONTEXT, phase: 'entered' },
    payload: { ...PAYLOAD_OF_CONTEXT, phase: 'entered' }
  },
  {
    name: 'a denied capability names its bounded reason',
    event: {
      ...CONTEXT,
      phase: 'preview_failed',
      failure_category: 'api_rejected',
      denial_reason: 'not_workspace_owner'
    },
    payload: {
      ...PAYLOAD_OF_CONTEXT,
      phase: 'preview_failed',
      failure_category: 'api_rejected',
      denial_reason: 'not_workspace_owner'
    }
  },
  {
    name: 'a refused quote names the checkout code',
    event: {
      ...CONTEXT,
      phase: 'preview_failed',
      failure_category: 'api_rejected',
      error_code: 'quote_not_allowed'
    },
    payload: {
      ...PAYLOAD_OF_CONTEXT,
      phase: 'preview_failed',
      failure_category: 'api_rejected',
      error_code: 'quote_not_allowed'
    }
  },
  {
    name: 'a method choice names its rail and kind',
    event: {
      ...CONTEXT,
      phase: 'method_selected',
      rail: 'new',
      method_kind: 'alipay'
    },
    payload: {
      ...PAYLOAD_OF_CONTEXT,
      phase: 'method_selected',
      rail: 'new',
      method_kind: 'alipay'
    }
  },
  {
    name: 'a method on file carries no kind',
    event: { ...CONTEXT, phase: 'method_selected', rail: 'on_file' },
    payload: {
      ...PAYLOAD_OF_CONTEXT,
      phase: 'method_selected',
      rail: 'on_file'
    }
  },
  {
    name: 'a promo result names whether the link carried the code',
    event: { ...CONTEXT, phase: 'promo', result: 'applied', prefilled: true },
    payload: {
      ...PAYLOAD_OF_CONTEXT,
      phase: 'promo',
      result: 'applied',
      prefilled: true
    }
  },
  {
    name: 'a promo the customer typed reports prefilled as false, not absent',
    event: { ...CONTEXT, phase: 'promo', result: 'rejected', prefilled: false },
    payload: {
      ...PAYLOAD_OF_CONTEXT,
      phase: 'promo',
      result: 'rejected',
      prefilled: false
    }
  },
  {
    name: 'a blocked pay names its reason',
    event: { ...CONTEXT, phase: 'pay_blocked', reason: 'promo_unapplied' },
    payload: {
      ...PAYLOAD_OF_CONTEXT,
      phase: 'pay_blocked',
      reason: 'promo_unapplied'
    }
  },
  {
    name: 'a failed preview without a refusal carries only its category',
    event: {
      ...CONTEXT,
      phase: 'preview_failed',
      failure_category: 'network'
    },
    payload: {
      ...PAYLOAD_OF_CONTEXT,
      phase: 'preview_failed',
      failure_category: 'network'
    }
  },
  {
    name: 'an abandoned checkout names the last phase it reached and how the customer left',
    event: {
      ...CONTEXT,
      billing_op_id: 'op-1',
      phase: 'abandoned',
      last_phase: 'operation_linked',
      exit: 'page_exit'
    },
    payload: {
      ...PAYLOAD_OF_CONTEXT,
      billing_op_id: 'op-1',
      phase: 'abandoned',
      last_phase: 'operation_linked',
      exit: 'page_exit'
    }
  },
  {
    name: 'an ending names its screen and whose payment it was',
    event: {
      ...CONTEXT,
      phase: 'ended',
      ending_kind: 'success',
      attribution: 'started'
    },
    payload: {
      ...PAYLOAD_OF_CONTEXT,
      phase: 'ended',
      ending_kind: 'success',
      attribution: 'started'
    }
  },
  {
    name: 'an ending no payment reached carries no attribution',
    event: { ...CONTEXT, phase: 'ended', ending_kind: 'refused' },
    payload: { ...PAYLOAD_OF_CONTEXT, phase: 'ended', ending_kind: 'refused' }
  }
]

describe('the checkout journey payload', () => {
  it.for(CASES)('$name', ({ event, payload }) => {
    expect(getCheckoutJourneyTelemetryEventPayload(event)).toStrictEqual(
      payload
    )
  })
})

const baseContext = {
  checkout_journey_id: 'journey-1',
  checkout_entered_at: '2026-09-09T00:00:00.000Z',
  entry_flow: 'initial_subscription',
  entry_source: 'pricing'
} as const

describe('getCheckoutJourneyTelemetryEventName', () => {
  it('derives the wire name from the phase', () => {
    const event: CheckoutJourneyTelemetryEvent = {
      ...baseContext,
      phase: 'preview_ready',
      assignment_status: 'resolved',
      assigned_arm: 'treatment'
    }
    expect(getCheckoutJourneyTelemetryEventName(event)).toBe(
      'billing.checkout.preview_ready'
    )
  })

  // The table is a total Record, so a missing phase fails to compile — but a
  // swapped value (entered -> 'billing.checkout.submitted') would not. Comparing
  // each key against its own value restores what the template literal proved.
  it.for(Object.entries(CHECKOUT_JOURNEY_EVENT_NAME_BY_PHASE))(
    'names %s after its own phase',
    ([phase, name]) => {
      expect(name).toBe(`billing.checkout.${phase}`)

      const event = {
        ...baseContext,
        phase,
        assignment_status: 'unavailable'
      } as CheckoutJourneyTelemetryEvent
      expect(getCheckoutJourneyTelemetryEventName(event)).toBe(name)
    }
  )
})

describe('getCheckoutJourneyTelemetryEventPayload', () => {
  it('stamps schema version and carries the resolved arm', () => {
    const event: CheckoutJourneyTelemetryEvent = {
      ...baseContext,
      phase: 'entered',
      assignment_status: 'resolved',
      assigned_arm: 'control'
    }
    const payload = getCheckoutJourneyTelemetryEventPayload(event)
    expect(payload.schema_version).toBe(CHECKOUT_JOURNEY_SCHEMA_VERSION)
    expect(payload.assigned_arm).toBe('control')
  })

  it('omits absent optional context rather than emitting undefined keys', () => {
    const event: CheckoutJourneyTelemetryEvent = {
      ...baseContext,
      phase: 'entered',
      assignment_status: 'unavailable'
    }
    const payload = getCheckoutJourneyTelemetryEventPayload(event)
    expect('billing_op_id' in payload).toBe(false)
    expect('ui_mode' in payload).toBe(false)
  })

  it('carries the ui_mode the user actually saw', () => {
    const event: CheckoutJourneyTelemetryEvent = {
      ...baseContext,
      phase: 'entered',
      assignment_status: 'resolved',
      assigned_arm: 'treatment',
      ui_mode: 'embedded'
    }
    const payload = getCheckoutJourneyTelemetryEventPayload(event)
    expect(payload.ui_mode).toBe('embedded')
  })

  it('carries phase-specific fields for a failed preview', () => {
    const event: CheckoutJourneyTelemetryEvent = {
      ...baseContext,
      phase: 'preview_failed',
      assignment_status: 'resolved',
      assigned_arm: 'treatment',
      failure_category: 'network',
      preview_revision: 'rev-7'
    }
    const payload = getCheckoutJourneyTelemetryEventPayload(event)
    expect(payload).toMatchObject({
      phase: 'preview_failed',
      failure_category: 'network',
      preview_revision: 'rev-7'
    })
  })

  it('distinguishes the failing element from the failure phase', () => {
    const event: CheckoutJourneyTelemetryEvent = {
      ...baseContext,
      phase: 'payment_element_failed',
      assignment_status: 'resolved',
      assigned_arm: 'treatment',
      element: 'address',
      element_phase: 'mount'
    }
    const payload = getCheckoutJourneyTelemetryEventPayload(event)
    expect(payload).toMatchObject({
      element: 'address',
      element_phase: 'mount'
    })
  })
})
