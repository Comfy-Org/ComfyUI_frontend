import { describe, expect, it } from 'vitest'

import type { BillingTelemetryEvent } from './billingTelemetryEvent.js'
import { getBillingTelemetryEventName } from './billingTelemetryEvent.js'
import { getBillingWebTelemetryEventPayload } from './payload.js'

describe('a web entry event', () => {
  it.for([
    {
      event: {
        operation: 'web_entry',
        stage: 'received',
        outcome: 'pending',
        intent: 'checkout',
        product: 'comfyui',
        has_plan: true,
        payment_intent_source: 'agent_paywall',
        correlation_id: 'journey-1'
      },
      name: 'billing.web_entry.received'
    },
    {
      event: {
        operation: 'web_entry',
        stage: 'received',
        outcome: 'pending',
        intent: 'subscription',
        product: 'platform',
        has_plan: false
      },
      name: 'billing.web_entry.received'
    },
    {
      event: {
        operation: 'web_entry',
        stage: 'rejected',
        outcome: 'pending',
        error_code: 'INVALID_AMOUNT'
      },
      name: 'billing.web_entry.rejected'
    },
    {
      event: {
        operation: 'web_entry',
        stage: 'bounced',
        outcome: 'pending',
        reason: 'planless_checkout',
        to: 'pricing_table'
      },
      name: 'billing.web_entry.bounced'
    }
  ] satisfies { event: BillingTelemetryEvent; name: string }[])(
    'is named $name and reports every field it carries',
    ({ event, name }) => {
      expect(getBillingTelemetryEventName(event)).toBe(name)
      expect(getBillingWebTelemetryEventPayload(event)).toStrictEqual({
        ...event,
        billing_surface: 'billing_web'
      })
    }
  )
})
