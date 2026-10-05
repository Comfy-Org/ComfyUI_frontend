import { describe, expect, it } from 'vitest'

import { getBillingTelemetryEventName } from './billingTelemetryEvent.js'
import type { BillingTelemetryEvent } from './billingTelemetryEvent.js'
import { getCloudAppBillingTelemetryEventPayload } from './payload.js'

describe('the entry events', () => {
  it.for<{
    name: string
    event: BillingTelemetryEvent
    eventName: string
    payload: Record<string, unknown>
  }>([
    {
      name: 'a paywall impression with its source and plan',
      event: {
        operation: 'entry',
        stage: 'paywall_shown',
        outcome: 'pending',
        payment_intent_source: 'out_of_credits',
        current_tier: 'pro'
      },
      eventName: 'billing.entry.paywall_shown',
      payload: {
        operation: 'entry',
        stage: 'paywall_shown',
        outcome: 'pending',
        payment_intent_source: 'out_of_credits',
        current_tier: 'pro',
        billing_surface: 'cloud_app'
      }
    },
    {
      name: 'a paywall impression that names neither',
      event: { operation: 'entry', stage: 'paywall_shown', outcome: 'pending' },
      eventName: 'billing.entry.paywall_shown',
      payload: {
        operation: 'entry',
        stage: 'paywall_shown',
        outcome: 'pending',
        billing_surface: 'cloud_app'
      }
    },
    {
      name: 'an add-credits click with its source',
      event: {
        operation: 'entry',
        stage: 'add_credits_clicked',
        outcome: 'pending',
        payment_intent_source: 'deep_link'
      },
      eventName: 'billing.entry.add_credits_clicked',
      payload: {
        operation: 'entry',
        stage: 'add_credits_clicked',
        outcome: 'pending',
        payment_intent_source: 'deep_link',
        billing_surface: 'cloud_app'
      }
    }
  ])('names and reports $name', ({ event, eventName, payload }) => {
    expect(getBillingTelemetryEventName(event)).toBe(eventName)
    expect(getCloudAppBillingTelemetryEventPayload(event)).toStrictEqual(
      payload
    )
  })
})
