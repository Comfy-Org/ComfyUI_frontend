import { beforeEach, describe, expect, it } from 'vitest'

import type { PendingSubscriptionCheckout } from './pendingSubscriptionCheckout'
import {
  blockingOperationIdFromError,
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

// ASSUMPTION PENDING BE-10062: the refusal is expected to name the blocking
// operation as `details.billing_op_id` on the standard ErrorResponse envelope
// (`{ code, message, details? }`), the schema's existing slot for structured
// error context. The flat case below hedges against it landing top-level
// instead. Both fixtures need reconciling with whatever BE-10062 ships.
describe('blockingOperationIdFromError', () => {
  const refusal = (extra: object) =>
    Object.assign(new Error('a subscription change is already in progress'), {
      code: 'SUBSCRIPTION_CHANGE_IN_PROGRESS',
      ...extra
    })

  it('reads the blocking operation from the error details', () => {
    expect(
      blockingOperationIdFromError(
        refusal({ details: { billing_op_id: 'op-blocking' } })
      )
    ).toBe('op-blocking')
  })

  it('reads a top-level blocking operation id', () => {
    expect(
      blockingOperationIdFromError(refusal({ billing_op_id: 'op-blocking' }))
    ).toBe('op-blocking')
  })

  it('reports nothing while the refusal omits the operation id', () => {
    expect(blockingOperationIdFromError(refusal({}))).toBeNull()
    expect(blockingOperationIdFromError(refusal({ details: {} }))).toBeNull()
    expect(
      blockingOperationIdFromError(refusal({ details: { billing_op_id: '' } }))
    ).toBeNull()
  })

  it('ignores errors that are not a change-in-progress refusal', () => {
    expect(
      blockingOperationIdFromError(
        Object.assign(new Error('stale'), {
          code: 'SUBSCRIPTION_QUOTE_STALE',
          details: { billing_op_id: 'op-unrelated' }
        })
      )
    ).toBeNull()
    expect(blockingOperationIdFromError(new Error('network'))).toBeNull()
    expect(blockingOperationIdFromError(undefined)).toBeNull()
  })
})
