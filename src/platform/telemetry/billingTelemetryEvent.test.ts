import { describe, expect, expectTypeOf, it } from 'vitest'

import { toBillingTelemetryEvent } from '@/platform/workspace/billing/sdk/billingSdkTelemetry'

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
  it.for<{
    name: string
    event: BillingTelemetryEvent
    client: 'sdk' | 'legacy'
  }>([
    {
      name: 'the SDK lifecycle starts a subscription operation',
      event: toBillingTelemetryEvent({
        name: 'billing.operation.started',
        billing_op_id: 'op-subscribe',
        operation_type: 'subscription',
        presentation: 'hosted',
        resumed: false
      }),
      client: 'sdk'
    },
    {
      name: 'the SDK lifecycle settles a top-up operation',
      event: toBillingTelemetryEvent({
        name: 'billing.operation.succeeded',
        billing_op_id: 'op-topup',
        operation_type: 'topup',
        presentation: 'embedded',
        resumed: true,
        duration_ms: 1200
      }),
      client: 'sdk'
    },
    {
      name: 'the SDK lifecycle times out a cancel operation',
      event: toBillingTelemetryEvent({
        name: 'billing.operation.timeout',
        billing_op_id: 'op-cancel',
        operation_type: 'cancel',
        presentation: 'hosted',
        resumed: false,
        failure_category: 'poll_timeout',
        duration_ms: 600_000
      }),
      client: 'sdk'
    },
    {
      name: 'the poller fails a subscription operation',
      event: {
        operation: 'operation',
        stage: 'failed',
        outcome: 'failure',
        operation_type: 'subscription',
        billing_op_id: 'op-polled',
        failure_category: 'provider_decline'
      },
      client: 'legacy'
    },
    {
      name: 'a legacy cancel starts',
      event: {
        operation: 'operation',
        stage: 'started',
        outcome: 'pending',
        operation_type: 'cancel'
      },
      client: 'legacy'
    },
    {
      name: 'a legacy subscription checkout succeeds',
      event: {
        operation: 'subscription_checkout',
        stage: 'succeeded',
        outcome: 'success',
        billing_op_id: 'op-checkout'
      },
      client: 'legacy'
    },
    {
      name: 'a legacy top-up checkout is received',
      event: {
        operation: 'topup',
        stage: 'checkout_received',
        outcome: 'pending',
        billing_op_id: 'op-topup-checkout',
        checkout_status: 'pending'
      },
      client: 'legacy'
    },
    {
      name: 'a legacy resubscribe fails',
      event: {
        operation: 'resubscribe',
        stage: 'failed',
        outcome: 'failure',
        source: 'settings_billing_panel',
        failure_category: 'network'
      },
      client: 'legacy'
    },
    {
      name: 'a legacy downgrade to personal starts',
      event: {
        operation: 'downgrade_to_personal',
        stage: 'started',
        outcome: 'pending',
        member_removal_count: 1,
        member_removal_failures: 0
      },
      client: 'legacy'
    },
    {
      name: 'a capability read fails',
      event: {
        operation: 'capability_read',
        stage: 'failed',
        outcome: 'failure'
      },
      client: 'legacy'
    }
  ])(
    'names the cloud app surface and the $client client when $name',
    ({ event, client }) => {
      const { billing_surface, billing_client } =
        getBillingTelemetryEventPayload(event)

      expect({ billing_surface, billing_client }).toEqual({
        billing_surface: 'cloud_app',
        billing_client: client
      })
    }
  )

  it("keeps every field of the SDK lifecycle's event", () => {
    const sdkFailure = toBillingTelemetryEvent({
      name: 'billing.operation.failed',
      billing_op_id: 'op-declined',
      operation_type: 'topup',
      presentation: 'embedded',
      resumed: false,
      failure_category: 'provider_decline',
      decline_reason: 'card_declined',
      duration_ms: 2300
    })

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
      duration_ms: 2300,
      billing_surface: 'cloud_app',
      billing_client: 'sdk'
    })
  })

  it("keeps every field of the poller's event, which has no SDK fields", () => {
    expect(
      getBillingTelemetryEventPayload({
        operation: 'operation',
        stage: 'failed',
        outcome: 'failure',
        operation_type: 'subscription',
        billing_op_id: 'op-polled',
        tier: 'pro',
        cycle: 'monthly',
        checkout_type: 'new',
        payment_intent_source: 'subscribe_now_button',
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
      cycle: 'monthly',
      checkout_type: 'new',
      payment_intent_source: 'subscribe_now_button',
      failure_category: 'provider_decline',
      duration_ms: 4200,
      billing_surface: 'cloud_app',
      billing_client: 'legacy'
    })
  })

  it('drops fields outside the contract and keeps its own surface', () => {
    const event = {
      operation: 'topup',
      stage: 'failed',
      outcome: 'failure',
      billing_op_id: 'opaque-op-id',
      failure_category: 'unknown',
      email: 'user@example.com',
      billing_surface: 'billing_web'
    } satisfies BillingTelemetryEvent & {
      email: string
      billing_surface: string
    }

    expect(getBillingTelemetryEventPayload(event)).toStrictEqual({
      operation: 'topup',
      stage: 'failed',
      outcome: 'failure',
      billing_op_id: 'opaque-op-id',
      failure_category: 'unknown',
      billing_surface: 'cloud_app',
      billing_client: 'legacy'
    })
  })
})
