import { describe, expect, it } from 'vitest'

import type { BillingOperationTelemetryEvent } from '../operationLifecycle.js'
import { toBillingTelemetryEvent } from './operationLifecycleEvent.js'

describe('toBillingTelemetryEvent', () => {
  it.for<{
    name: string
    event: BillingOperationTelemetryEvent
    expected: Record<string, unknown>
  }>([
    {
      name: 'a start, paired to its terminal by operation id',
      event: {
        name: 'billing.operation.started',
        billing_op_id: 'op-start',
        operation_type: 'topup',
        presentation: 'hosted',
        resumed: true
      },
      expected: {
        operation: 'operation',
        billing_client: 'sdk',
        stage: 'started',
        outcome: 'pending',
        operation_type: 'topup',
        billing_op_id: 'op-start',
        presentation: 'hosted',
        resumed: true
      }
    },
    {
      name: 'a success with its duration',
      event: {
        name: 'billing.operation.succeeded',
        billing_op_id: 'op-success',
        operation_type: 'subscription',
        presentation: 'embedded',
        resumed: false,
        duration_ms: 1500
      },
      expected: {
        operation: 'operation',
        billing_client: 'sdk',
        stage: 'succeeded',
        outcome: 'success',
        operation_type: 'subscription',
        billing_op_id: 'op-success',
        presentation: 'embedded',
        resumed: false,
        duration_ms: 1500
      }
    },
    {
      name: 'a declined failure with its decline reason',
      event: {
        name: 'billing.operation.failed',
        billing_op_id: 'op-declined',
        operation_type: 'topup',
        presentation: 'embedded',
        resumed: true,
        failure_category: 'provider_decline',
        decline_reason: 'insufficient_funds',
        duration_ms: 2300
      },
      expected: {
        operation: 'operation',
        billing_client: 'sdk',
        stage: 'failed',
        outcome: 'failure',
        operation_type: 'topup',
        billing_op_id: 'op-declined',
        presentation: 'embedded',
        resumed: true,
        failure_category: 'provider_decline',
        decline_reason: 'insufficient_funds',
        duration_ms: 2300
      }
    },
    {
      name: 'a failure the provider never declined, without a decline reason',
      event: {
        name: 'billing.operation.failed',
        billing_op_id: 'op-reconcile',
        operation_type: 'cancel',
        presentation: 'hosted',
        resumed: false,
        failure_category: 'reconciliation_needed',
        duration_ms: 900
      },
      expected: {
        operation: 'operation',
        billing_client: 'sdk',
        stage: 'failed',
        outcome: 'failure',
        operation_type: 'cancel',
        billing_op_id: 'op-reconcile',
        presentation: 'hosted',
        resumed: false,
        failure_category: 'reconciliation_needed',
        duration_ms: 900
      }
    },
    {
      name: 'a timeout as a poll timeout',
      event: {
        name: 'billing.operation.timeout',
        billing_op_id: 'op-timeout',
        operation_type: 'subscription',
        presentation: 'hosted',
        resumed: true,
        failure_category: 'poll_timeout',
        duration_ms: 600_000
      },
      expected: {
        operation: 'operation',
        billing_client: 'sdk',
        stage: 'timeout',
        outcome: 'failure',
        operation_type: 'subscription',
        billing_op_id: 'op-timeout',
        presentation: 'hosted',
        resumed: true,
        failure_category: 'poll_timeout',
        duration_ms: 600_000
      }
    },
    {
      name: 'a required challenge onto the checkout, never as an operation stage',
      event: {
        name: 'billing.checkout.challenge_required',
        billing_op_id: 'op-challenge',
        operation_type: 'subscription',
        presentation: 'embedded',
        resumed: false
      },
      expected: {
        operation: 'checkout',
        billing_client: 'sdk',
        stage: 'challenge_required',
        outcome: 'pending',
        operation_type: 'subscription',
        billing_op_id: 'op-challenge',
        presentation: 'embedded',
        resumed: false
      }
    },
    {
      name: 'a completed challenge as still pending, since the server settles the payment',
      event: {
        name: 'billing.checkout.challenge_completed',
        billing_op_id: 'op-challenge',
        operation_type: 'topup',
        presentation: 'embedded',
        resumed: true
      },
      expected: {
        operation: 'checkout',
        billing_client: 'sdk',
        stage: 'challenge_completed',
        outcome: 'pending',
        operation_type: 'topup',
        billing_op_id: 'op-challenge',
        presentation: 'embedded',
        resumed: true
      }
    },
    {
      name: 'a retryable decline with its reason',
      event: {
        name: 'billing.checkout.challenge_failed',
        billing_op_id: 'op-retry',
        operation_type: 'subscription',
        presentation: 'hosted',
        resumed: false,
        decline_reason: 'card_declined'
      },
      expected: {
        operation: 'checkout',
        billing_client: 'sdk',
        stage: 'challenge_failed',
        outcome: 'pending',
        operation_type: 'subscription',
        billing_op_id: 'op-retry',
        presentation: 'hosted',
        resumed: false,
        decline_reason: 'card_declined'
      }
    },
    {
      name: 'a hosted step opened, with where it leads and the method',
      event: {
        name: 'billing.checkout.redirect_started',
        billing_op_id: 'op-redirect',
        operation_type: 'subscription',
        presentation: 'hosted',
        resumed: false,
        destination: 'stripe',
        step: 'payment_method',
        navigation: 'redirect',
        method_kind: 'alipay'
      },
      expected: {
        operation: 'checkout',
        billing_client: 'sdk',
        stage: 'redirect_started',
        outcome: 'pending',
        operation_type: 'subscription',
        billing_op_id: 'op-redirect',
        presentation: 'hosted',
        resumed: false,
        destination: 'stripe',
        step: 'payment_method',
        navigation: 'redirect',
        method_kind: 'alipay'
      }
    },
    {
      name: 'a return from a hosted step, without a method the host never knew',
      event: {
        name: 'billing.checkout.returned',
        billing_op_id: 'op-redirect',
        operation_type: 'topup',
        presentation: 'hosted',
        resumed: true,
        destination: 'billing_web',
        step: 'authentication',
        navigation: 'new_tab'
      },
      expected: {
        operation: 'checkout',
        billing_client: 'sdk',
        stage: 'returned',
        outcome: 'pending',
        operation_type: 'topup',
        billing_op_id: 'op-redirect',
        presentation: 'hosted',
        resumed: true,
        destination: 'billing_web',
        step: 'authentication',
        navigation: 'new_tab'
      }
    }
  ])('maps $name', ({ event, expected }) => {
    expect(toBillingTelemetryEvent(event)).toEqual(expected)
  })
})
