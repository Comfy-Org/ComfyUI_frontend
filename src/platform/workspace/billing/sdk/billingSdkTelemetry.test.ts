import { describe, expect, it } from 'vitest'

import { toBillingTelemetryEvent } from './billingSdkTelemetry'

describe('toBillingTelemetryEvent', () => {
  it('reports a start without a duration or an id, as the poller does', () => {
    expect(
      toBillingTelemetryEvent({
        name: 'billing.operation.started',
        billing_op_id: 'op-1',
        operation_type: 'topup',
        presentation: 'hosted',
        resumed: true
      })
    ).toEqual({
      operation: 'operation',
      operation_type: 'topup',
      stage: 'started',
      outcome: 'pending'
    })
  })

  it.for([
    [
      'billing.operation.succeeded',
      undefined,
      { stage: 'succeeded', outcome: 'success' }
    ],
    [
      'billing.operation.failed',
      'reconciliation_needed',
      {
        stage: 'failed',
        outcome: 'failure',
        failure_category: 'reconciliation_needed'
      }
    ],
    [
      'billing.operation.timeout',
      'poll_timeout',
      { stage: 'timeout', outcome: 'failure', failure_category: 'poll_timeout' }
    ]
  ] as const)(
    'maps %s onto the terminal payload with its category and duration',
    ([name, category, expected]) => {
      expect(
        toBillingTelemetryEvent({
          name,
          billing_op_id: 'op-1',
          operation_type: 'topup',
          presentation: 'embedded',
          resumed: false,
          ...(category === undefined ? {} : { failure_category: category }),
          duration_ms: 1500
        })
      ).toEqual({
        operation: 'operation',
        operation_type: 'topup',
        billing_op_id: 'op-1',
        duration_ms: 1500,
        ...expected
      })
    }
  )
})
