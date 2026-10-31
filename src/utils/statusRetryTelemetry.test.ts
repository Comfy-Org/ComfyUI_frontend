import { describe, expect, it } from 'vitest'

import type { StatusRetrySettlement } from '@/utils/statusRetryTelemetry'
import { abortEnd, classifyStatusRetry } from '@/utils/statusRetryTelemetry'

describe('classifyStatusRetry', () => {
  it.for<[string, StatusRetrySettlement, string | undefined]>([
    [
      'a first answer',
      { end: 'answered', attempts: 1, finalStatus: 200, retryScheduled: false },
      undefined
    ],
    [
      'a success after a retry',
      { end: 'answered', attempts: 2, finalStatus: 204, retryScheduled: true },
      'recovered'
    ],
    [
      'an error status after a retry',
      { end: 'answered', attempts: 2, finalStatus: 500, retryScheduled: true },
      'failed'
    ],
    [
      'a redirect the caller asked to see after a retry',
      { end: 'answered', attempts: 2, finalStatus: 302, retryScheduled: true },
      'failed'
    ],
    [
      'an opaque answer after a retry',
      { end: 'answered', attempts: 2, finalStatus: 0, retryScheduled: true },
      'failed'
    ],
    [
      'spent attempts',
      {
        end: 'attempts_spent',
        attempts: 3,
        finalStatus: 503,
        retryScheduled: true
      },
      'exhausted'
    ],
    [
      'a no-retry read',
      {
        end: 'attempts_spent',
        attempts: 1,
        finalStatus: 503,
        retryScheduled: false
      },
      undefined
    ],
    [
      'a long Retry-After',
      {
        end: 'retry_after_too_long',
        attempts: 1,
        finalStatus: 503,
        retryScheduled: false
      },
      'retry_after_too_long'
    ],
    [
      'a timeout after a scheduled retry',
      { end: 'timeout', attempts: 1, finalStatus: 503, retryScheduled: true },
      'timeout_budget'
    ],
    [
      'a timeout on the first request',
      { end: 'timeout', attempts: 1, retryScheduled: false },
      undefined
    ],
    [
      'no response after a retry',
      { end: 'network', attempts: 2, finalStatus: 503, retryScheduled: true },
      'failed'
    ],
    [
      'no response on the first request',
      { end: 'network', attempts: 1, retryScheduled: false },
      undefined
    ],
    [
      'a caller cancel',
      { end: 'cancelled', attempts: 1, finalStatus: 503, retryScheduled: true },
      undefined
    ]
  ])('classifies %s', ([_name, settlement, outcome]) => {
    expect(classifyStatusRetry(settlement)).toBe(outcome)
  })
})

describe('abortEnd', () => {
  it('treats an unaborted failure as a network failure', () => {
    expect(abortEnd(new AbortController().signal)).toBe('network')
    expect(abortEnd(undefined)).toBe('network')
  })

  it('tells the request timeout from a caller abort', () => {
    const timedOut = new AbortController()
    timedOut.abort(new DOMException('Fetch timeout', 'TimeoutError'))
    const cancelled = new AbortController()
    cancelled.abort()

    expect(abortEnd(timedOut.signal)).toBe('timeout')
    expect(abortEnd(cancelled.signal)).toBe('cancelled')
  })
})
