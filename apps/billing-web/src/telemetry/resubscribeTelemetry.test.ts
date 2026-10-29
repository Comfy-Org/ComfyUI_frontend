import { describe, expect, it, vi } from 'vitest'

import type {
  BillingTelemetryEvent,
  SubscriptionCommandResult
} from '@comfyorg/account-core/billing'
import { getBillingWebTelemetryEventPayload } from '@comfyorg/account-core/billing'

import { createResubscribeTelemetry } from '@/telemetry/resubscribeTelemetry'
import { failedOperation, succeededOperation } from '@/test/fakeBillingClient'

function recorder() {
  const events: BillingTelemetryEvent[] = []
  return {
    events,
    track: (event: BillingTelemetryEvent) => void events.push(event)
  }
}

function clock(...ticks: number[]) {
  const now = vi.fn<() => number>()
  for (const tick of ticks) now.mockReturnValueOnce(tick)
  return now
}

const BILLING_WEB = {
  operation: 'resubscribe',
  source: 'billing_web_subscription',
  billing_client: 'sdk'
}

describe('createResubscribeTelemetry', () => {
  it.for<{
    name: string
    result: SubscriptionCommandResult
    terminal: Record<string, unknown>
  }>([
    {
      name: 'a resubscribe the server settled',
      result: {
        status: 'ok',
        value: { phase: 'succeeded', operation: succeededOperation('op_9') }
      },
      terminal: {
        stage: 'succeeded',
        outcome: 'success',
        billing_op_id: 'op_9'
      }
    },
    {
      name: 'a plan that was already active, which counts as succeeded',
      result: { status: 'ok', value: { phase: 'succeeded' } },
      terminal: { stage: 'succeeded', outcome: 'success' }
    },
    {
      name: 'a decline',
      result: {
        status: 'ok',
        value: {
          phase: 'failed',
          operation: failedOperation('card_declined', 'op_9')
        }
      },
      terminal: {
        stage: 'failed',
        outcome: 'failure',
        failure_category: 'provider_decline',
        decline_reason: 'card_declined',
        billing_op_id: 'op_9'
      }
    },
    {
      name: 'a refusal before any operation exists',
      result: { status: 'error', code: 'REQUEST_FAILED' },
      terminal: {
        stage: 'failed',
        outcome: 'failure',
        failure_category: 'network'
      }
    }
  ])('reports $name from its start, timed from the press', async (row) => {
    const { events, track } = recorder()
    const attempts = createResubscribeTelemetry({
      track,
      now: clock(1000, 3200)
    })

    await attempts.run({ source: 'avatar_menu_plans' }, async () => row.result)

    expect(events).toEqual([
      {
        ...BILLING_WEB,
        stage: 'started',
        outcome: 'pending',
        payment_intent_source: 'avatar_menu_plans'
      },
      {
        ...BILLING_WEB,
        ...row.terminal,
        payment_intent_source: 'avatar_menu_plans',
        duration_ms: 2200
      }
    ])
  })

  it('claims no entry source for a customer who arrived without one', async () => {
    const { events, track } = recorder()
    const attempts = createResubscribeTelemetry({ track })

    await attempts.run(undefined, async () => ({
      status: 'ok',
      value: { phase: 'succeeded' }
    }))

    expect(
      events.map((event) => getBillingWebTelemetryEventPayload(event))
    ).toEqual([
      {
        ...BILLING_WEB,
        stage: 'started',
        outcome: 'pending',
        billing_surface: 'billing_web'
      },
      {
        ...BILLING_WEB,
        stage: 'succeeded',
        outcome: 'success',
        duration_ms: expect.any(Number),
        billing_surface: 'billing_web'
      }
    ])
  })
})
