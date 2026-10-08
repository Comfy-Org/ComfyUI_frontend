import { describe, expect, it } from 'vitest'

import { getBillingTelemetryEventName } from './billingTelemetryEvent.js'
import type { BillingTelemetryEvent } from './billingTelemetryEvent.js'
import { BILLING_TELEMETRY_EVENTS } from './eventNames.js'
import {
  getBillingWebTelemetryEventPayload,
  getCloudAppBillingTelemetryEventPayload
} from './payload.js'

describe('the portal events', () => {
  it.for<{
    name: string
    event: BillingTelemetryEvent
    eventName: string
    payload: Record<string, unknown>
  }>([
    {
      name: 'the portal opening on its payment methods',
      event: {
        operation: 'portal',
        stage: 'opened',
        outcome: 'pending',
        target: 'payment_methods',
        billing_client: 'sdk'
      },
      eventName: 'billing.portal.opened',
      payload: {
        operation: 'portal',
        stage: 'opened',
        outcome: 'pending',
        target: 'payment_methods',
        billing_client: 'sdk'
      }
    },
    {
      name: 'the portal failing to open on its invoices',
      event: {
        operation: 'portal',
        stage: 'failed',
        outcome: 'failure',
        target: 'invoices',
        failure_category: 'redirect',
        error_code: 'payment_popup_blocked'
      },
      eventName: 'billing.portal.failed',
      payload: {
        operation: 'portal',
        stage: 'failed',
        outcome: 'failure',
        target: 'invoices',
        failure_category: 'redirect',
        error_code: 'payment_popup_blocked'
      }
    },
    {
      name: 'the customer coming back from managing the subscription',
      event: {
        operation: 'portal',
        stage: 'returned',
        outcome: 'pending',
        target: 'manage_subscription'
      },
      eventName: 'billing.portal.returned',
      payload: {
        operation: 'portal',
        stage: 'returned',
        outcome: 'pending',
        target: 'manage_subscription'
      }
    },
    {
      name: 'the portal opening to recover a failed payment',
      event: {
        operation: 'portal',
        stage: 'opened',
        outcome: 'pending',
        target: 'payment_recovery',
        billing_client: 'legacy'
      },
      eventName: 'billing.portal.opened',
      payload: {
        operation: 'portal',
        stage: 'opened',
        outcome: 'pending',
        target: 'payment_recovery',
        billing_client: 'legacy'
      }
    }
  ])('names and reports $name', ({ event, eventName, payload }) => {
    expect(getBillingTelemetryEventName(event)).toBe(eventName)
    expect(Object.values(BILLING_TELEMETRY_EVENTS)).toContain(eventName)
    expect(getCloudAppBillingTelemetryEventPayload(event)).toStrictEqual({
      ...payload,
      billing_surface: 'cloud_app'
    })
    expect(getBillingWebTelemetryEventPayload(event)).toStrictEqual({
      ...payload,
      billing_surface: 'billing_web'
    })
  })
})
