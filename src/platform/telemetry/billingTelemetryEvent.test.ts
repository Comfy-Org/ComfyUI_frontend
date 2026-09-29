import { describe, expect, it } from 'vitest'

import type { BillingTelemetryEvent } from './types'

describe('BillingTelemetryEvent', () => {
  it('allows late success only on succeeded recovery terminals', () => {
    const events: BillingTelemetryEvent[] = [
      {
        operation: 'subscription_checkout',
        stage: 'succeeded',
        outcome: 'success',
        recovery_outcome: 'late_success'
      },
      {
        operation: 'resubscribe',
        source: 'settings_billing_panel',
        stage: 'succeeded',
        outcome: 'success',
        recovery_outcome: 'late_success'
      },
      {
        operation: 'subscription_checkout',
        stage: 'timeout',
        outcome: 'failure',
        failure_category: 'poll_timeout',
        // @ts-expect-error Late success is not a timeout outcome.
        recovery_outcome: 'late_success'
      },
      {
        operation: 'resubscribe',
        source: 'settings_billing_panel',
        stage: 'failed',
        outcome: 'failure',
        failure_category: 'network',
        // @ts-expect-error Late success is not a failure outcome.
        recovery_outcome: 'late_success'
      }
    ]

    expect(events).toHaveLength(4)
  })
})
