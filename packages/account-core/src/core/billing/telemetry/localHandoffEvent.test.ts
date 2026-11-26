import { describe, expect, it } from 'vitest'

import { getBillingTelemetryEventName } from './billingTelemetryEvent'
import type { BillingTelemetryEvent } from './billingTelemetryEvent'
import { BILLING_TELEMETRY_EVENTS } from './eventNames'
import { getCloudAppBillingTelemetryEventPayload } from './payload'

describe('the local handoff launch event', () => {
  it.for<{ name: string; event: BillingTelemetryEvent }>([
    {
      name: 'an opened launch',
      event: {
        operation: 'local_handoff',
        stage: 'launched',
        outcome: 'pending',
        surface: 'local_web',
        result: 'opened'
      }
    },
    {
      name: 'a refusal Cloud explained',
      event: {
        operation: 'local_handoff',
        stage: 'launched',
        outcome: 'failed',
        surface: 'local_web',
        result: 'refused',
        error_code: 'HANDOFF_DISABLED'
      }
    }
  ])('names and reports $name', ({ event }) => {
    expect(getBillingTelemetryEventName(event)).toBe(
      'billing.local_handoff.launched'
    )
    expect(Object.values(BILLING_TELEMETRY_EVENTS)).toContain(
      'billing.local_handoff.launched'
    )
    expect(getCloudAppBillingTelemetryEventPayload(event)).toStrictEqual({
      ...event,
      billing_surface: 'cloud_app'
    })
  })
})
