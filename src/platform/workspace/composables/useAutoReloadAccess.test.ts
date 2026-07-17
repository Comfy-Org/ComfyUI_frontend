import { describe, expect, it } from 'vitest'

import { isAutoReloadFrozen } from '@/platform/workspace/composables/useAutoReloadAccess'

describe('isAutoReloadFrozen', () => {
  it.for([
    ['paused', 'active'],
    ['inactive', 'active'],
    ['paid', 'ended']
  ] as const)(
    'freezes billing status %s with subscription status %s',
    ([billingStatus, subscriptionStatus]) => {
      expect(isAutoReloadFrozen(billingStatus, subscriptionStatus)).toBe(true)
    }
  )

  it('keeps an active cancellation interactive until the plan ends', () => {
    expect(isAutoReloadFrozen('paid', 'canceled')).toBe(false)
  })

  it('keeps payment-failed billing interactive', () => {
    expect(isAutoReloadFrozen('payment_failed', 'active')).toBe(false)
  })

  it.for([
    [null, null],
    ['awaiting_payment_method', 'active'],
    ['pending_payment', 'scheduled'],
    ['paid', 'scheduled']
  ] as const)(
    'keeps non-terminal billing status %s / subscription status %s interactive',
    ([billingStatus, subscriptionStatus]) => {
      expect(isAutoReloadFrozen(billingStatus, subscriptionStatus)).toBe(false)
    }
  )
})
