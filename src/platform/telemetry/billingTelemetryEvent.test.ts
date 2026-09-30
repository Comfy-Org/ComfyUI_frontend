import { describe, expect, expectTypeOf, it } from 'vitest'

import type { BillingTelemetryEvent } from './types'
import { getBillingTelemetryEventPayload } from './types'

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

describe('getBillingTelemetryEventPayload', () => {
  it("keeps the SDK rail's presentation, resumption and decline reason", () => {
    const sdkFailure = {
      operation: 'operation',
      stage: 'failed',
      outcome: 'failure',
      operation_type: 'topup',
      billing_op_id: 'op-declined',
      presentation: 'embedded',
      resumed: false,
      failure_category: 'provider_decline',
      decline_reason: 'card_declined',
      duration_ms: 2300
    } as const

    expect(getBillingTelemetryEventPayload(sdkFailure)).toStrictEqual({
      operation: 'operation',
      stage: 'failed',
      outcome: 'failure',
      operation_type: 'topup',
      billing_op_id: 'op-declined',
      presentation: 'embedded',
      resumed: false,
      failure_category: 'provider_decline',
      decline_reason: 'card_declined',
      duration_ms: 2300
    })
  })

  it("leaves the poller's operation event, which has none of them, unchanged", () => {
    expect(
      getBillingTelemetryEventPayload({
        operation: 'operation',
        stage: 'failed',
        outcome: 'failure',
        operation_type: 'subscription',
        billing_op_id: 'op-polled',
        tier: 'pro',
        failure_category: 'provider_decline',
        duration_ms: 4200
      })
    ).toStrictEqual({
      operation: 'operation',
      stage: 'failed',
      outcome: 'failure',
      operation_type: 'subscription',
      billing_op_id: 'op-polled',
      tier: 'pro',
      failure_category: 'provider_decline',
      duration_ms: 4200
    })
  })
})
