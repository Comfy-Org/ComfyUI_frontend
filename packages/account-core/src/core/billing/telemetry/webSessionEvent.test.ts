import { describe, expect, it } from 'vitest'

import type { BillingTelemetryEvent } from './billingTelemetryEvent.js'
import { getBillingTelemetryEventName } from './billingTelemetryEvent.js'
import { getBillingWebTelemetryEventPayload } from './payload.js'

describe('a web session event', () => {
  it.for([
    {
      event: {
        operation: 'web_session',
        stage: 'signin_required',
        outcome: 'pending',
        reason: 'refused'
      },
      name: 'billing.web_session.signin_required'
    },
    {
      event: {
        operation: 'web_session',
        stage: 'established',
        outcome: 'pending',
        origin: 'interactive',
        mode: 'web-session'
      },
      name: 'billing.web_session.established'
    },
    {
      event: {
        operation: 'web_session',
        stage: 'failed',
        outcome: 'pending',
        error_code: 'TOKEN_EXCHANGE_FAILED'
      },
      name: 'billing.web_session.failed'
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
