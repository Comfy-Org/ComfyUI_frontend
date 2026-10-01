import { describe, expect, it } from 'vitest'

import type { CheckoutJourneyTelemetryEvent } from './checkoutJourney.js'
import { getCheckoutJourneyTelemetryEventPayload } from './checkoutJourney.js'

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
  }
]

describe('the checkout journey payload', () => {
  it.for(CASES)('$name', ({ event, payload }) => {
    expect(getCheckoutJourneyTelemetryEventPayload(event)).toStrictEqual(
      payload
    )
  })
})
