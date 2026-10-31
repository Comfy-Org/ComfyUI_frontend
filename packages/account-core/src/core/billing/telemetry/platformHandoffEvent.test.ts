import { describe, expect, it } from 'vitest'

import { getBillingTelemetryEventName } from './billingTelemetryEvent'
import type { BillingTelemetryEvent } from './billingTelemetryEvent'
import { BILLING_TELEMETRY_EVENTS } from './eventNames'
import { getCloudAppBillingTelemetryEventPayload } from './payload'

describe('the platform handoff event', () => {
  it.for<{ name: string; event: BillingTelemetryEvent }>([
    {
      name: 'the auto top-up card action',
      event: {
        operation: 'platform_handoff',
        stage: 'opened',
        outcome: 'pending',
        target: 'auto_top_up',
        action: 'update_payment',
        correlation_id: 'journey-1'
      }
    },
    {
      name: 'the plans link',
      event: {
        operation: 'platform_handoff',
        stage: 'opened',
        outcome: 'pending',
        target: 'plans',
        correlation_id: 'journey-2'
      }
    },
    {
      name: 'the usage link',
      event: {
        operation: 'platform_handoff',
        stage: 'opened',
        outcome: 'pending',
        target: 'usage',
        correlation_id: 'journey-3'
      }
    }
  ])('names and reports $name with its journey', ({ event }) => {
    expect(getBillingTelemetryEventName(event)).toBe(
      'billing.platform_handoff.opened'
    )
    expect(Object.values(BILLING_TELEMETRY_EVENTS)).toContain(
      'billing.platform_handoff.opened'
    )
    expect(getCloudAppBillingTelemetryEventPayload(event)).toStrictEqual({
      ...event,
      billing_surface: 'cloud_app'
    })
  })
})
