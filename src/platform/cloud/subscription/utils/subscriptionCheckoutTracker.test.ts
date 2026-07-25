import { beforeEach, describe, expect, it } from 'vitest'

import {
  clearPendingSubscriptionCheckoutAttempt,
  consumePendingSubscriptionCheckoutSuccess,
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

  it('round-trips payment_intent_source from attempt to success metadata', () => {
    recordPendingSubscriptionCheckoutAttempt({
      tier: 'pro',
      cycle: 'monthly',
      checkout_type: 'new',
      payment_intent_source: 'subscribe_to_run'
    })

    const metadata = consumePendingSubscriptionCheckoutSuccess(activeProStatus)

    expect(metadata).toMatchObject({
      tier: 'pro',
      checkout_type: 'new',
      payment_intent_source: 'subscribe_to_run'
    })
  })

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
})
