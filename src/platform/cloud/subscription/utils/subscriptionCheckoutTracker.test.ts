import { afterEach, describe, expect, it, vi } from 'vitest'

import {
  clearPendingSubscriptionCheckoutAttempt,
  hasPendingSubscriptionCheckoutAttempt,
  recordPendingSubscriptionCheckoutAttempt
} from './subscriptionCheckoutTracker'

const originalLocalStorageDescriptor = Object.getOwnPropertyDescriptor(
  globalThis,
  'localStorage'
)

function restoreLocalStorage() {
  if (originalLocalStorageDescriptor) {
    Object.defineProperty(
      globalThis,
      'localStorage',
      originalLocalStorageDescriptor
    )
    return
  }

  Reflect.deleteProperty(globalThis, 'localStorage')
}

describe('subscriptionCheckoutTracker', () => {
  afterEach(() => {
    restoreLocalStorage()
  })

  it('fails open when reading localStorage throws', () => {
    Object.defineProperty(globalThis, 'localStorage', {
      configurable: true,
      get() {
        throw new Error('blocked storage')
      }
    })

    expect(() =>
      recordPendingSubscriptionCheckoutAttempt({
        tier: 'creator',
        cycle: 'monthly',
        checkout_type: 'new'
      })
    ).not.toThrow()

    expect(hasPendingSubscriptionCheckoutAttempt()).toBe(false)
    expect(() => clearPendingSubscriptionCheckoutAttempt()).not.toThrow()
  })

  it('fails open when storage methods throw', () => {
    Object.defineProperty(globalThis, 'localStorage', {
      configurable: true,
      value: {
        getItem: vi.fn(() => {
          throw new Error('getItem blocked')
        }),
        setItem: vi.fn(() => {
          throw new Error('setItem blocked')
        }),
        removeItem: vi.fn(() => {
          throw new Error('removeItem blocked')
        })
      }
    })

    expect(
      recordPendingSubscriptionCheckoutAttempt({
        tier: 'pro',
        cycle: 'yearly',
        checkout_type: 'change'
      })
    ).toMatchObject({
      tier: 'pro',
      cycle: 'yearly',
      checkout_type: 'change'
    })

    expect(hasPendingSubscriptionCheckoutAttempt()).toBe(false)
    expect(() => clearPendingSubscriptionCheckoutAttempt()).not.toThrow()
  })
})
