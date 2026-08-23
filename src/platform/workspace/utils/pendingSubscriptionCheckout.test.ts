import { beforeEach, describe, expect, it } from 'vitest'

import {
  getPendingSubscriptionCheckout,
  savePendingSubscriptionCheckout
} from './pendingSubscriptionCheckout'

const STORAGE_KEY = 'comfy:pending-subscription-checkout'

describe('pendingSubscriptionCheckout', () => {
  beforeEach(() => sessionStorage.clear())

  it('rejects and clears stale checkout context', () => {
    const now = Date.now()
    savePendingSubscriptionCheckout({
      operationId: 'op-stale',
      workspaceId: 'workspace-1',
      selection: {
        planMode: 'personal',
        tierKey: 'standard',
        billingCycle: 'yearly'
      },
      attemptedAt: now - 24 * 60 * 60_000 - 1
    })

    expect(getPendingSubscriptionCheckout(now)).toBeNull()
    expect(sessionStorage.getItem(STORAGE_KEY)).toBeNull()
  })

  it('rejects and clears malformed checkout context', () => {
    sessionStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        operationId: 'op-malformed',
        workspaceId: 'workspace-1',
        selection: {
          planMode: 'personal',
          tierKey: 'free',
          billingCycle: 'yearly'
        },
        attemptedAt: Date.now()
      })
    )

    expect(getPendingSubscriptionCheckout()).toBeNull()
    expect(sessionStorage.getItem(STORAGE_KEY)).toBeNull()
  })
})
