import { describe, expect, it } from 'vitest'

import { getBillingTelemetryEventName } from './billingTelemetryEvent.js'
import type { BillingTelemetryEvent } from './billingTelemetryEvent.js'
import {
  getBillingWebTelemetryEventPayload,
  getCloudAppBillingTelemetryEventPayload
} from './payload.js'

describe('the cancel events', () => {
  it.for<{
    name: string
    event: BillingTelemetryEvent
    eventName: string
    payload: Record<string, unknown>
  }>([
    {
      name: 'the cancel flow opening',
      event: {
        operation: 'cancel',
        stage: 'intent',
        outcome: 'pending',
        current_tier: 'pro',
        cycle: 'yearly'
      },
      eventName: 'billing.cancel.intent',
      payload: {
        operation: 'cancel',
        stage: 'intent',
        outcome: 'pending',
        current_tier: 'pro',
        cycle: 'yearly'
      }
    },
    {
      name: 'the customer leaving the flow',
      event: { operation: 'cancel', stage: 'abandoned', outcome: 'pending' },
      eventName: 'billing.cancel.abandoned',
      payload: { operation: 'cancel', stage: 'abandoned', outcome: 'pending' }
    },
    {
      name: 'a refusal before any operation exists',
      event: {
        operation: 'cancel',
        stage: 'failed',
        outcome: 'failure',
        failure_category: 'network',
        current_tier: 'team'
      },
      eventName: 'billing.cancel.failed',
      payload: {
        operation: 'cancel',
        stage: 'failed',
        outcome: 'failure',
        failure_category: 'network',
        current_tier: 'team'
      }
    }
  ])('names and reports $name', ({ event, eventName, payload }) => {
    expect(getBillingTelemetryEventName(event)).toBe(eventName)
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
