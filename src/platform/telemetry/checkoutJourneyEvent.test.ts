import { describe, expect, it } from 'vitest'

import {
  CHECKOUT_JOURNEY_EVENT_NAME_BY_PHASE,
  CHECKOUT_JOURNEY_SCHEMA_VERSION,
  getCheckoutJourneyTelemetryEventName,
  getCheckoutJourneyTelemetryEventPayload
} from './types'
import type { CheckoutJourneyTelemetryEvent } from './types'

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

  it('omits assigned_arm when assignment is unavailable', () => {
    const event: CheckoutJourneyTelemetryEvent = {
      ...baseContext,
      phase: 'entered',
      assignment_status: 'unavailable'
    }
    const payload = getCheckoutJourneyTelemetryEventPayload(event)
    expect(payload.assignment_status).toBe('unavailable')
    expect('assigned_arm' in payload).toBe(false)
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
