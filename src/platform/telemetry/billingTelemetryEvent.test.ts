import {
  getBillingTelemetryEventPayload,
  getCloudAppBillingTelemetryEventPayload,
  toBillingTelemetryEvent
} from '@comfyorg/account-core/billing'
import type { BillingTelemetryEvent } from '@comfyorg/account-core/billing'
import { pick } from 'es-toolkit'
import { describe, expect, expectTypeOf, it } from 'vitest'

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
    claim: { billing_client?: 'sdk' | 'legacy' }
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
      claim: { billing_client: 'sdk' }
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
      claim: { billing_client: 'sdk' }
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
      claim: { billing_client: 'sdk' }
    },
    {
      name: 'the legacy poller fails a subscription operation',
      event: {
        operation: 'operation',
        stage: 'failed',
        outcome: 'failure',
        operation_type: 'subscription',
        billing_op_id: 'op-polled',
        failure_category: 'provider_decline',
        billing_client: 'legacy'
      },
      claim: { billing_client: 'legacy' }
    },
    {
      name: 'shared workspace code starts a cancel before choosing a rail',
      event: {
        operation: 'operation',
        stage: 'started',
        outcome: 'pending',
        operation_type: 'cancel'
      },
      claim: {}
    },
    {
      name: 'shared workspace code reports a subscription checkout intent',
      event: {
        operation: 'subscription_checkout',
        stage: 'intent',
        outcome: 'pending',
        tier: 'pro',
        cycle: 'monthly'
      },
      claim: {}
    },
    {
      name: 'shared workspace code starts a top-up',
      event: {
        operation: 'topup',
        stage: 'started',
        outcome: 'pending'
      },
      claim: {}
    },
    {
      name: 'shared workspace code fails a resubscribe',
      event: {
        operation: 'resubscribe',
        stage: 'failed',
        outcome: 'failure',
        source: 'settings_billing_panel',
        failure_category: 'network'
      },
      claim: {}
    },
    {
      name: 'shared workspace code starts a downgrade to personal',
      event: {
        operation: 'downgrade_to_personal',
        stage: 'started',
        outcome: 'pending',
        member_removal_count: 1,
        member_removal_failures: 0
      },
      claim: {}
    },
    {
      name: 'shared workspace code fails a capability read',
      event: {
        operation: 'capability_read',
        stage: 'failed',
        outcome: 'failure'
      },
      claim: {}
    }
  ])(
    'carries only the client the emitter knows when $name',
    ({ event, claim }) => {
      expect(
        pick(getBillingTelemetryEventPayload(event), ['billing_client'])
      ).toStrictEqual(claim)
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
        duration_ms: 4200,
        billing_client: 'legacy'
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
      billing_client: 'legacy'
    })
  })

  it('drops fields outside the contract and claims no surface', () => {
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
      failure_category: 'unknown'
    })
  })
})

describe('getCloudAppBillingTelemetryEventPayload', () => {
  it('names the cloud app surface over any surface the event carries', () => {
    const event = {
      operation: 'resubscribe',
      stage: 'started',
      outcome: 'pending',
      source: 'settings_billing_panel',
      billing_surface: 'billing_web'
    } satisfies BillingTelemetryEvent & { billing_surface: string }

    expect(getCloudAppBillingTelemetryEventPayload(event)).toStrictEqual({
      operation: 'resubscribe',
      stage: 'started',
      outcome: 'pending',
      source: 'settings_billing_panel',
      billing_surface: 'cloud_app'
    })
  })
})
