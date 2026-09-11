import { describe, expect, it } from 'vitest'

import {
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
    expect('checkout_attempt_id' in payload).toBe(false)
    expect('billing_op_id' in payload).toBe(false)
    expect('ui_mode' in payload).toBe(false)
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

  it('distinguishes the element failure phase', () => {
    const event: CheckoutJourneyTelemetryEvent = {
      ...baseContext,
      phase: 'payment_element_failed',
      assignment_status: 'resolved',
      assigned_arm: 'treatment',
      element_phase: 'mount'
    }
    const payload = getCheckoutJourneyTelemetryEventPayload(event)
    expect(payload).toMatchObject({ element_phase: 'mount' })
  })
})
