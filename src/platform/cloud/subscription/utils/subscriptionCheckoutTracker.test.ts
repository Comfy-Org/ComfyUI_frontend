import { beforeEach, describe, expect, it, vi } from 'vitest'

import {
  claimPendingCheckoutTerminal,
  clearPendingSubscriptionCheckoutAttempt,
  consumePendingSubscriptionCheckoutSuccess,
  getPendingCheckoutTerminal,
  getPendingSubscriptionCheckoutAttempt,
  PENDING_SUBSCRIPTION_CHECKOUT_STORAGE_KEY,
  recordPendingSubscriptionCheckoutAttempt
} from './subscriptionCheckoutTracker'

const activeProStatus = {
  is_active: true,
  subscription_tier: 'PRO',
  subscription_duration: 'MONTHLY'
} as const

describe('subscriptionCheckoutTracker', () => {
  beforeEach(() => {
    clearPendingSubscriptionCheckoutAttempt()
  })

  it.for([
    'subscribe_to_run',
    'upload_model_upgrade',
    'team_upgrade_resume',
    'free_tier_quota'
  ] as const)(
    'round-trips %s from attempt to success metadata',
    (paymentIntentSource) => {
      recordPendingSubscriptionCheckoutAttempt({
        tier: 'pro',
        cycle: 'monthly',
        checkout_type: 'new',
        payment_intent_source: paymentIntentSource
      })

      const metadata =
        consumePendingSubscriptionCheckoutSuccess(activeProStatus)

      expect(metadata).toMatchObject({
        tier: 'pro',
        checkout_type: 'new',
        payment_intent_source: paymentIntentSource
      })
    }
  )

  it.for([
    {
      name: 'a reported start survives',
      stored: { start_reported: true },
      startReported: true
    },
    {
      name: 'an attempt stored without it still parses',
      stored: {},
      startReported: undefined
    },
    {
      name: 'a value other than true is dropped',
      stored: { start_reported: 'true' },
      startReported: undefined
    }
  ])(
    'round-trips the start marker through storage: $name',
    ({ stored, startReported }) => {
      localStorage.setItem(
        PENDING_SUBSCRIPTION_CHECKOUT_STORAGE_KEY,
        JSON.stringify({
          attempt_id: 'attempt-marker',
          started_at_ms: Date.now(),
          tier: 'pro',
          cycle: 'monthly',
          checkout_type: 'new',
          ...stored
        })
      )

      const attempt = getPendingSubscriptionCheckoutAttempt()
      const consumed =
        consumePendingSubscriptionCheckoutSuccess(activeProStatus)

      expect(attempt).toMatchObject({ attempt_id: 'attempt-marker' })
      expect(attempt?.start_reported).toBe(startReported)
      expect(consumed?.start_reported).toBe(startReported)
    }
  )

  it('omits payment_intent_source when the attempt had none', () => {
    recordPendingSubscriptionCheckoutAttempt({
      tier: 'pro',
      cycle: 'monthly',
      checkout_type: 'new'
    })

    const metadata = consumePendingSubscriptionCheckoutSuccess(activeProStatus)

    expect(metadata).not.toBeNull()
    expect(metadata).not.toHaveProperty('payment_intent_source')
  })

  it('classifies success after unreachable recovery as late success', () => {
    const attempt = recordPendingSubscriptionCheckoutAttempt({
      tier: 'pro',
      cycle: 'monthly',
      checkout_type: 'new'
    })
    claimPendingCheckoutTerminal(attempt.attempt_id, 'recovery_unreachable')

    expect(consumePendingSubscriptionCheckoutSuccess(activeProStatus)).toEqual(
      expect.objectContaining({
        checkout_attempt_id: attempt.attempt_id,
        recovery_outcome: 'late_success'
      })
    )
  })

  it('requires the cancellation marker to change before consuming a resubscribe', () => {
    recordPendingSubscriptionCheckoutAttempt({
      tier: 'pro',
      cycle: 'monthly',
      checkout_type: 'change',
      operation: 'resubscribe',
      previous_cancel_at: '2026-10-01'
    })

    expect(
      consumePendingSubscriptionCheckoutSuccess({
        ...activeProStatus,
        cancel_at: '2026-10-01'
      })
    ).toBeNull()
    expect(
      consumePendingSubscriptionCheckoutSuccess({
        ...activeProStatus,
        cancel_at: null
      })
    ).toEqual(expect.objectContaining({ operation: 'resubscribe' }))
  })

  it.for(['1e400', '-1e400'])(
    'rejects a non-finite start time of %s',
    (time) => {
      localStorage.setItem(
        PENDING_SUBSCRIPTION_CHECKOUT_STORAGE_KEY,
        `{"attempt_id":"invalid-time","started_at_ms":${time},"tier":"pro","cycle":"monthly","checkout_type":"new"}`
      )

      expect(getPendingSubscriptionCheckoutAttempt()).toBeNull()
    }
  )

  it('persists bounded clock skew as the current start time', () => {
    localStorage.setItem(
      PENDING_SUBSCRIPTION_CHECKOUT_STORAGE_KEY,
      JSON.stringify({
        attempt_id: 'future-attempt',
        started_at_ms: Date.now() + 60_000,
        tier: 'pro',
        cycle: 'monthly',
        checkout_type: 'new'
      })
    )

    expect(getPendingSubscriptionCheckoutAttempt()).toEqual(
      expect.objectContaining({
        attempt_id: 'future-attempt',
        started_at_ms: Date.now()
      })
    )
    vi.advanceTimersByTime(60_000)

    expect(getPendingSubscriptionCheckoutAttempt()?.started_at_ms).toBe(
      Date.now() - 60_000
    )
  })

  it('rejects a timestamp beyond the allowed clock skew', () => {
    const startedAt = Date.now() + 6 * 60 * 1000
    localStorage.setItem(
      PENDING_SUBSCRIPTION_CHECKOUT_STORAGE_KEY,
      JSON.stringify({
        attempt_id: 'far-future-attempt',
        started_at_ms: startedAt,
        tier: 'pro',
        cycle: 'monthly',
        checkout_type: 'new'
      })
    )

    expect(getPendingSubscriptionCheckoutAttempt()).toBeNull()
    expect(
      localStorage.getItem(PENDING_SUBSCRIPTION_CHECKOUT_STORAGE_KEY)
    ).toBeNull()
  })

  it('claims one terminal for the current attempt', () => {
    const staleAttempt = recordPendingSubscriptionCheckoutAttempt({
      tier: 'pro',
      cycle: 'monthly',
      checkout_type: 'new'
    })
    const currentAttempt = recordPendingSubscriptionCheckoutAttempt({
      tier: 'pro',
      cycle: 'monthly',
      checkout_type: 'new'
    })

    expect(
      claimPendingCheckoutTerminal(
        staleAttempt.attempt_id,
        'recovery_unreachable'
      )
    ).toBeNull()
    expect(
      claimPendingCheckoutTerminal(
        currentAttempt.attempt_id,
        'recovery_unreachable'
      )
    ).toEqual(currentAttempt)
    expect(
      claimPendingCheckoutTerminal(
        currentAttempt.attempt_id,
        'completion_missing'
      )
    ).toBeNull()
    expect(getPendingCheckoutTerminal(currentAttempt.attempt_id)).toBe(
      'recovery_unreachable'
    )
  })

  it('does not claim a terminal when storage writes fail', () => {
    const attempt = recordPendingSubscriptionCheckoutAttempt({
      tier: 'pro',
      cycle: 'monthly',
      checkout_type: 'new'
    })
    vi.spyOn(localStorage, 'setItem').mockImplementation(() => {
      throw new Error('storage unavailable')
    })

    expect(
      claimPendingCheckoutTerminal(attempt.attempt_id, 'completion_missing')
    ).toBeNull()
    expect(getPendingCheckoutTerminal(attempt.attempt_id)).toBeNull()
  })
})
