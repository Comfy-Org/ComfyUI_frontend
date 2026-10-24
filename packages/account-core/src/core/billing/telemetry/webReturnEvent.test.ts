import { describe, expect, it } from 'vitest'

import type { BillingTelemetryEvent } from './billingTelemetryEvent'
import { getBillingTelemetryEventName } from './billingTelemetryEvent'
import { getBillingWebTelemetryEventPayload } from './payload'

describe('a web return event', () => {
  it('is named billing.web_return.clicked and reports the control', () => {
    const event = {
      operation: 'web_return',
      stage: 'clicked',
      outcome: 'pending',
      control: 'success_close'
    } satisfies BillingTelemetryEvent

    expect(getBillingTelemetryEventName(event)).toBe(
      'billing.web_return.clicked'
    )
    expect(getBillingWebTelemetryEventPayload(event)).toStrictEqual({
      ...event,
      billing_surface: 'billing_web'
    })
  })
})
