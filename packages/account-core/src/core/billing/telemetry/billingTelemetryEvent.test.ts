import { describe, expectTypeOf, it } from 'vitest'

import type { BillingTelemetryEvent } from './billingTelemetryEvent.js'

type LateSuccessEvent = Extract<
  BillingTelemetryEvent,
  { recovery_outcome?: 'late_success' }
>

describe('BillingTelemetryEvent', () => {
  it('allows late success only on succeeded recovery terminals', () => {
    expectTypeOf<LateSuccessEvent['stage']>().toEqualTypeOf<'succeeded'>()
    expectTypeOf<LateSuccessEvent['operation']>().toEqualTypeOf<
      'subscription_checkout' | 'resubscribe'
    >()
  })
})
