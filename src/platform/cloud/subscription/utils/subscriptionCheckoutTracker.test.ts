import { beforeEach, describe, expect, it } from 'vitest'

import {
  clearPendingSubscriptionCheckoutAttempt,
  consumePendingSubscriptionCheckoutSuccess,
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

  it('rejects a checkout attempt from the future', () => {
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

    expect(getPendingSubscriptionCheckoutAttempt()).toBeNull()
  })
})
