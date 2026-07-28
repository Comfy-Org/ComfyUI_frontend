import { afterEach, describe, expect, it, vi } from 'vitest'

import type { BillingTelemetryEvent } from '../../types'
import { TelemetryEvents } from '../../types'
import { DatadogRumTelemetryProvider } from './DatadogRumTelemetryProvider'

const { addAction, addDurationVital, getInternalContext } = vi.hoisted(() => ({
  addAction: vi.fn(),
  addDurationVital: vi.fn(),
  getInternalContext: vi.fn()
}))

vi.mock('@datadog/browser-rum', () => ({
  datadogRum: { addAction, addDurationVital, getInternalContext }
}))

afterEach(() => {
  vi.restoreAllMocks()
  vi.clearAllMocks()
})

describe('DatadogRumTelemetryProvider', () => {
  it('records the same canonical billing name and context as PostHog', () => {
    const event: BillingTelemetryEvent = {
      operation: 'operation',
      stage: 'failed',
      outcome: 'failure',
      billing_op_id: 'opaque-op-id',
      operation_type: 'subscription',
      tier: 'pro',
      cycle: 'monthly',
      checkout_type: 'new',
      payment_intent_source: 'subscribe_to_run',
      failure_category: 'provider_decline'
    }

    new DatadogRumTelemetryProvider().trackBillingEvent(event)

    expect(addAction).toHaveBeenCalledExactlyOnceWith(
      TelemetryEvents.BILLING_OPERATION_FAILED,
      event
    )
  })

  it('drops fields outside the billing telemetry contract', () => {
    const event = {
      operation: 'topup',
      stage: 'failed',
      outcome: 'failure',
      billing_op_id: 'opaque-op-id',
      failure_category: 'unknown',
      error_message: 'raw provider response',
      email: 'user@example.com'
    } satisfies BillingTelemetryEvent & {
      error_message: string
      email: string
    }

    new DatadogRumTelemetryProvider().trackBillingEvent(event)

    expect(addAction).toHaveBeenCalledExactlyOnceWith(
      TelemetryEvents.BILLING_TOPUP_FAILED,
      {
        operation: 'topup',
        stage: 'failed',
        outcome: 'failure',
        billing_op_id: 'opaque-op-id',
        failure_category: 'unknown'
      }
    )
  })

  it.for(['success', 'failure'] as const)(
    'records a workflow vital with a %s outcome',
    (outcome) => {
      getInternalContext.mockReturnValue({ view: { id: 'view-a' } })
      vi.spyOn(performance, 'now').mockReturnValue(142)

      new DatadogRumTelemetryProvider().trackExecutionOutcome({
        startTime: 42,
        outcome
      })

      expect(getInternalContext).toHaveBeenCalledWith(42)
      expect(addDurationVital).toHaveBeenCalledWith('workflow_execution', {
        startTime: performance.timeOrigin + 42,
        duration: 100,
        context: {
          origin_view_id: 'view-a',
          outcome,
          product: 'cloud_generation'
        }
      })
    }
  )
})
