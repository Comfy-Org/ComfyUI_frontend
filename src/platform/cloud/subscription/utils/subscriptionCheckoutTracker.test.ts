import { beforeEach, describe, expect, it, vi } from 'vitest'

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

  it('uses secure random values for attempt IDs on insecure origins', () => {
    vi.stubGlobal('crypto', {
      getRandomValues: (bytes: Uint8Array) => {
        bytes.fill(0)
        return bytes
      }
    })

    const attempt = recordPendingSubscriptionCheckoutAttempt({
      tier: 'pro',
      cycle: 'monthly',
      checkout_type: 'new'
    })

    expect(attempt.attempt_id).toBe('00000000-0000-4000-8000-000000000000')
  })
})
