import { describe, expect, it } from 'vitest'

import { WorkspaceApiError } from '@/platform/remote/ingest/ingestApiError'

import {
  busyRereadDelayMs,
  isSubscriptionChangeInProgress
} from './autoTopUpReadBusy'

describe('isSubscriptionChangeInProgress', () => {
  it('matches only a 409 SUBSCRIPTION_CHANGE_IN_PROGRESS workspace error', () => {
    expect(
      isSubscriptionChangeInProgress(
        new WorkspaceApiError('busy', 409, 'SUBSCRIPTION_CHANGE_IN_PROGRESS')
      )
    ).toBe(true)
    expect(
      isSubscriptionChangeInProgress(
        new WorkspaceApiError('busy', 500, 'SUBSCRIPTION_CHANGE_IN_PROGRESS')
      )
    ).toBe(false)
    expect(
      isSubscriptionChangeInProgress(
        new WorkspaceApiError(
          'conflict',
          409,
          'BILLING_RECONCILIATION_REQUIRED'
        )
      )
    ).toBe(false)
    expect(isSubscriptionChangeInProgress(new Error('busy'))).toBe(false)
  })
})

describe('busyRereadDelayMs', () => {
  it('follows Retry-After, capped at a minute, else waits 5 seconds', () => {
    const withRetryAfter = (seconds?: number) =>
      new WorkspaceApiError('busy', 409, 'x', undefined, 'op', seconds)
    expect(busyRereadDelayMs(withRetryAfter(2))).toBe(2_000)
    expect(busyRereadDelayMs(withRetryAfter(600))).toBe(60_000)
    expect(busyRereadDelayMs(withRetryAfter())).toBe(5_000)
    expect(busyRereadDelayMs(new Error('busy'))).toBe(5_000)
  })
})
