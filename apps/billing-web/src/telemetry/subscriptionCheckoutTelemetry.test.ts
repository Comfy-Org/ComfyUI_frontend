import { describe, expect, it, vi } from 'vitest'

import type {
  BillingTelemetryEvent,
  SubscriptionCommandResult,
  SubscriptionPreview
} from '@comfyorg/account-core/billing'

import type { CheckoutAttempt } from '@/telemetry/subscriptionCheckoutTelemetry'
import {
  checkoutAttemptOf,
  createSubscriptionCheckoutTelemetry
} from '@/telemetry/subscriptionCheckoutTelemetry'
import { previewOf, succeededOperation } from '@/test/fakeBillingClient'

const ATTEMPT: CheckoutAttempt = {
  tier: 'creator',
  cycle: 'monthly',
  checkoutType: 'new',
  source: 'subscribe_now_button'
}

const SETTLED: SubscriptionCommandResult = {
  status: 'ok',
  value: {
    phase: 'succeeded',
    operation: succeededOperation('op_1'),
    issuedStatus: 'subscribed'
  }
}

const NETWORK_FAILURE: SubscriptionCommandResult = {
  status: 'error',
  code: 'REQUEST_FAILED'
}

const MUST_CONFIRM: SubscriptionCommandResult = {
  status: 'error',
  code: 'REACTIVATION_CONFIRMATION_REQUIRED'
}

function recorder() {
  const events: BillingTelemetryEvent[] = []
  return {
    events,
    track: (event: BillingTelemetryEvent) => void events.push(event),
    stages: () => events.map((event) => event.stage)
  }
}

function clock(...ticks: number[]) {
  const now = vi.fn<() => number>()
  for (const tick of ticks) now.mockReturnValueOnce(tick)
  return now
}

function deferred<T>() {
  let resolve: (value: T) => void = () => {}
  const promise = new Promise<T>((settle) => {
    resolve = settle
  })
  return { promise, resolve }
}

describe('checkoutAttemptOf', () => {
  it.for<{
    name: string
    quote: Partial<SubscriptionPreview>
    expected: Omit<CheckoutAttempt, 'source'>
  }>([
    {
      name: 'a first subscription to a monthly tier',
      quote: {},
      expected: { tier: 'creator', cycle: 'monthly', checkoutType: 'new' }
    },
    {
      name: 'a yearly plan change',
      quote: {
        transition_type: 'upgrade',
        new_plan: {
          ...previewOf().new_plan,
          tier: 'PRO',
          duration: 'ANNUAL'
        }
      },
      expected: { tier: 'pro', cycle: 'yearly', checkoutType: 'change' }
    },
    {
      name: 'a downgrade',
      quote: { transition_type: 'downgrade' },
      expected: { tier: 'creator', cycle: 'monthly', checkoutType: 'change' }
    },
    {
      name: 'a team plan',
      quote: { new_plan: { ...previewOf().new_plan, tier: 'TEAM' } },
      expected: { tier: 'team', cycle: 'monthly', checkoutType: 'new' }
    },
    {
      name: 'the founders tier',
      quote: {
        new_plan: { ...previewOf().new_plan, tier: 'FOUNDERS_EDITION' }
      },
      expected: { tier: 'founder', cycle: 'monthly', checkoutType: 'new' }
    },
    {
      name: 'a tier billing web has no name for, which claims none',
      quote: { new_plan: { ...previewOf().new_plan, tier: 'ENTERPRISE' } },
      expected: { cycle: 'monthly', checkoutType: 'new' }
    }
  ])('reads $name from the quote', ({ quote, expected }) => {
    expect(checkoutAttemptOf(previewOf(quote), undefined)).toEqual({
      ...expected,
      source: undefined
    })
  })

  it('carries the entry source through', () => {
    expect(checkoutAttemptOf(previewOf(), { source: 'deep_link' }).source).toBe(
      'deep_link'
    )
  })
})

describe('createSubscriptionCheckoutTelemetry', () => {
  it('reports the intent and the start before the command, and the terminal after it', async () => {
    const { events, track } = recorder()
    const attempts = createSubscriptionCheckoutTelemetry({
      ui: 'embedded',
      track
    })
    let reportedBeforeCommand: string[] = []

    await attempts.run(ATTEMPT, async () => {
      reportedBeforeCommand = events.map((event) => event.stage)
      return SETTLED
    })

    expect(reportedBeforeCommand).toEqual(['intent', 'started'])
    expect(events.map((event) => event.stage)).toEqual([
      'intent',
      'started',
      'succeeded'
    ])
  })

  it('describes the attempt on every event and the operation id only once one exists', async () => {
    const { events, track } = recorder()
    const attempts = createSubscriptionCheckoutTelemetry({
      ui: 'full_page',
      track,
      now: clock(1000, 4500)
    })

    await attempts.run(ATTEMPT, async () => SETTLED)

    expect(events).toEqual([
      {
        operation: 'subscription_checkout',
        stage: 'intent',
        outcome: 'pending',
        billing_client: 'sdk',
        checkout_ui: 'full_page',
        tier: 'creator',
        cycle: 'monthly',
        checkout_type: 'new',
        payment_intent_source: 'subscribe_now_button'
      },
      {
        operation: 'subscription_checkout',
        stage: 'started',
        outcome: 'pending',
        billing_client: 'sdk',
        checkout_ui: 'full_page',
        tier: 'creator',
        cycle: 'monthly',
        checkout_type: 'new',
        payment_intent_source: 'subscribe_now_button'
      },
      {
        operation: 'subscription_checkout',
        stage: 'succeeded',
        outcome: 'success',
        billing_client: 'sdk',
        checkout_ui: 'full_page',
        tier: 'creator',
        cycle: 'monthly',
        checkout_type: 'new',
        payment_intent_source: 'subscribe_now_button',
        billing_op_id: 'op_1',
        duration_ms: 3500
      }
    ])
  })

  it('keeps one attempt open across the consent the server demands, timing it from the first press', async () => {
    const { events, track, stages } = recorder()
    const attempts = createSubscriptionCheckoutTelemetry({
      ui: 'embedded',
      track,
      now: clock(1000, 9000)
    })

    await attempts.run(ATTEMPT, async () => MUST_CONFIRM)
    expect(stages()).toEqual(['intent', 'started'])

    await attempts.run(ATTEMPT, async () => SETTLED)

    expect(stages()).toEqual(['intent', 'started', 'succeeded'])
    expect(events.at(-1)).toMatchObject({ duration_ms: 8000 })
  })

  it('starts a new attempt only after the previous one reached its terminal', async () => {
    const { events, track, stages } = recorder()
    const attempts = createSubscriptionCheckoutTelemetry({
      ui: 'embedded',
      track,
      now: clock(1000, 1400, 5000, 5900)
    })

    await attempts.run(ATTEMPT, async () => NETWORK_FAILURE)
    await attempts.run(ATTEMPT, async () => SETTLED)

    expect(stages()).toEqual([
      'intent',
      'started',
      'failed',
      'intent',
      'started',
      'succeeded'
    ])
    expect(events[2]).toMatchObject({
      failure_category: 'network',
      duration_ms: 400
    })
    expect(events[5]).toMatchObject({ duration_ms: 900 })
  })

  it('ends an attempt once when a second press joins it before it resolves', async () => {
    const { track, stages } = recorder()
    const attempts = createSubscriptionCheckoutTelemetry({
      ui: 'embedded',
      track
    })
    const first = deferred<SubscriptionCommandResult>()

    const pressed = attempts.run(ATTEMPT, () => first.promise)
    const joined = attempts.run(ATTEMPT, () => first.promise)
    first.resolve(SETTLED)
    await Promise.all([pressed, joined])

    expect(stages()).toEqual(['intent', 'started', 'succeeded'])
  })

  it('ends an attempt as an unknown failure when the command throws, and lets the error through', async () => {
    const { events, track, stages } = recorder()
    const attempts = createSubscriptionCheckoutTelemetry({
      ui: 'embedded',
      track
    })

    await expect(
      attempts.run(ATTEMPT, () => Promise.reject(new Error('boom')))
    ).rejects.toThrow('boom')
    await attempts.run(ATTEMPT, async () => SETTLED)

    expect(stages()).toEqual([
      'intent',
      'started',
      'failed',
      'intent',
      'started',
      'succeeded'
    ])
    expect(events[2]).toMatchObject({ failure_category: 'unknown' })
  })

  it('returns the command result untouched', async () => {
    const attempts = createSubscriptionCheckoutTelemetry({
      ui: 'embedded',
      track: recorder().track
    })

    await expect(
      attempts.run(ATTEMPT, async () => NETWORK_FAILURE)
    ).resolves.toBe(NETWORK_FAILURE)
  })
})
