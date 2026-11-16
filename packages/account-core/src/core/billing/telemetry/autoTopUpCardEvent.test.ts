import { describe, expect, it } from 'vitest'

import { getBillingTelemetryEventName } from './billingTelemetryEvent'
import { BILLING_TELEMETRY_EVENTS } from './eventNames'
import { getCloudAppBillingTelemetryEventPayload } from './payload'

describe('the auto top-up card event', () => {
  it.for(['failed', 'off', 'on_hold', 'paused_by_budget', 'on'] as const)(
    'names and reports the %s status',
    (status) => {
      const event = {
        operation: 'auto_top_up_card',
        stage: 'viewed',
        outcome: 'pending',
        status
      } as const

      expect(getBillingTelemetryEventName(event)).toBe(
        'billing.auto_top_up_card.viewed'
      )
      expect(Object.values(BILLING_TELEMETRY_EVENTS)).toContain(
        'billing.auto_top_up_card.viewed'
      )
      expect(getCloudAppBillingTelemetryEventPayload(event)).toStrictEqual({
        ...event,
        billing_surface: 'cloud_app'
      })
    }
  )
})
