import { describe, expect, it } from 'vitest'

import type { BillingTelemetryEvent } from './billingTelemetryEvent.js'
import { getCloudAppBillingTelemetryEventPayload } from './payload.js'
import { getTopupAmountPreset } from './topupEvent.js'
import type { TopupAmountPreset } from './topupEvent.js'

describe('the top-up amount preset', () => {
  it.for<{ picked: number | null; reported: TopupAmountPreset }>([
    { picked: 10, reported: '10' },
    { picked: 25, reported: '25' },
    { picked: 50, reported: '50' },
    { picked: 100, reported: '100' },
    { picked: null, reported: 'custom' },
    { picked: 75, reported: 'custom' }
  ])('reports $picked as $reported', ({ picked, reported }) => {
    expect(getTopupAmountPreset(picked)).toBe(reported)
  })
})

describe('the top-up started event', () => {
  it('reports the amount and the preset', () => {
    const event: BillingTelemetryEvent = {
      operation: 'topup',
      stage: 'started',
      outcome: 'pending',
      payment_intent_source: 'deep_link',
      amount_cents: 2500,
      amount_preset: '25'
    }

    expect(getCloudAppBillingTelemetryEventPayload(event)).toStrictEqual({
      operation: 'topup',
      stage: 'started',
      outcome: 'pending',
      payment_intent_source: 'deep_link',
      amount_cents: 2500,
      amount_preset: '25',
      billing_surface: 'cloud_app'
    })
  })
})
