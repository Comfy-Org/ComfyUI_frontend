import { describe, expect, it } from 'vitest'

import { getBillingTelemetryEventName } from './billingTelemetryEvent'
import { BILLING_TELEMETRY_EVENTS } from './eventNames'
import { getCloudAppBillingTelemetryEventPayload } from './payload'

describe('the auto top-up offer event', () => {
  it.for(['viewed', 'declined'] as const)('names and reports %s', (stage) => {
    const event = {
      operation: 'auto_top_up_offer',
      stage,
      outcome: 'pending'
    } as const

    expect(getBillingTelemetryEventName(event)).toBe(
      `billing.auto_top_up_offer.${stage}`
    )
    expect(Object.values(BILLING_TELEMETRY_EVENTS)).toContain(
      `billing.auto_top_up_offer.${stage}`
    )
    expect(getCloudAppBillingTelemetryEventPayload(event)).toStrictEqual({
      ...event,
      billing_surface: 'cloud_app'
    })
  })
})
