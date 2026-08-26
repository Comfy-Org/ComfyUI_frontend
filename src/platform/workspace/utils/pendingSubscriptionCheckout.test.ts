import { beforeEach, describe, expect, it } from 'vitest'

import type { PendingSubscriptionCheckout } from './pendingSubscriptionCheckout'
import {
  clearPendingSubscriptionCheckout,
  getPendingSubscriptionCheckout,
  savePendingSubscriptionCheckout
} from './pendingSubscriptionCheckout'

const STORAGE_KEY = 'comfy:pending-subscription-checkout'

function checkoutFixture(
  overrides: Partial<PendingSubscriptionCheckout> = {}
): PendingSubscriptionCheckout {
  return {
    operationId: 'op-1',
    workspaceId: 'workspace-1',
    ownerUid: 'user-1',
    selection: {
      planMode: 'personal',
      tierKey: 'standard',
      billingCycle: 'yearly'
    },
    attemptedAt: Date.now(),
    ...overrides
  }
}

describe('pendingSubscriptionCheckout', () => {
  beforeEach(() => sessionStorage.clear())

  it('round-trips a saved checkout', () => {
    const checkout = checkoutFixture()
    savePendingSubscriptionCheckout(checkout)

    expect(getPendingSubscriptionCheckout()).toEqual(checkout)
  })

  it('rejects and clears stale checkout context', () => {
    const now = Date.now()
    savePendingSubscriptionCheckout(
      checkoutFixture({
        operationId: 'op-stale',
        attemptedAt: now - 24 * 60 * 60_000 - 1
      })
    )

    expect(getPendingSubscriptionCheckout(now)).toBeNull()
    expect(sessionStorage.getItem(STORAGE_KEY)).toBeNull()
  })

  it('rejects and clears malformed checkout context', () => {
    sessionStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        ...checkoutFixture({ operationId: 'op-malformed' }),
        selection: {
          planMode: 'personal',
          tierKey: 'free',
          billingCycle: 'yearly'
        }
      })
    )

    expect(getPendingSubscriptionCheckout()).toBeNull()
    expect(sessionStorage.getItem(STORAGE_KEY)).toBeNull()
  })

  it('rejects and clears unparseable checkout context', () => {
    sessionStorage.setItem(STORAGE_KEY, '{not json')

    expect(getPendingSubscriptionCheckout()).toBeNull()
    expect(sessionStorage.getItem(STORAGE_KEY)).toBeNull()
  })

  it('clears only the entry matching the given operation id', () => {
    savePendingSubscriptionCheckout(checkoutFixture({ operationId: 'op-new' }))

    clearPendingSubscriptionCheckout('op-old')
    expect(getPendingSubscriptionCheckout()?.operationId).toBe('op-new')

    clearPendingSubscriptionCheckout('op-new')
    expect(getPendingSubscriptionCheckout()).toBeNull()
  })
})
