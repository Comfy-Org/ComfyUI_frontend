import { beforeEach, describe, expect, it, vi } from 'vitest'

import {
  clearPendingSubscriptionCheckoutAttempt,
  consumePendingSubscriptionCheckoutSuccess,
  getPendingSubscriptionCheckoutAttempt,
  hasReportedMissingCheckoutCompletion,
  markMissingCheckoutCompletionReported,
  markRecoveryUnreachableReported,
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
    markRecoveryUnreachableReported(attempt.attempt_id)

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

  it('accepts bounded clock skew without discarding a checkout attempt', () => {
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
      expect.objectContaining({ attempt_id: 'future-attempt' })
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

  it('deduplicates reports in memory when storage writes fail', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('storage unavailable')
    })

    markMissingCheckoutCompletionReported('attempt-without-storage')

    expect(
      hasReportedMissingCheckoutCompletion('attempt-without-storage')
    ).toBe(true)
  })

  it('deduplicates missing-completion reports from storage after a reload', async () => {
    markMissingCheckoutCompletionReported('attempt-across-reload')

    vi.resetModules()
    const reloadedTracker = await import('./subscriptionCheckoutTracker')

    expect(
      reloadedTracker.hasReportedMissingCheckoutCompletion(
        'attempt-across-reload'
      )
    ).toBe(true)
  })
})
