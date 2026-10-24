import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { RetryPolicy } from '@/utils/retryPolicy'
import {
  DEFAULT_RETRY_POLICY,
  parseRetryAfterMs,
  retryDelayMs,
  sleep
} from '@/utils/retryPolicy'

const NOW = Date.parse('2026-10-18T12:00:00Z')

describe('parseRetryAfterMs', () => {
  it.for<[string, string, number]>([
    ['delta-seconds', '5', 5_000],
    ['zero seconds', '0', 0],
    ['padded delta-seconds', ' 7 ', 7_000],
    ['an HTTP-date in the future', 'Sun, 18 Oct 2026 12:00:30 GMT', 30_000],
    ['an HTTP-date in the past', 'Sun, 18 Oct 2026 11:59:00 GMT', 0]
  ])('reads %s', ([_name, header, expected]) => {
    expect(parseRetryAfterMs(header, NOW)).toBe(expected)
  })

  it.for<[string, string | null | undefined]>([
    ['absent', undefined],
    ['null', null],
    ['empty', ''],
    ['garbage', 'soon'],
    ['negative', '-5'],
    ['fractional', '1.5']
  ])('ignores a header that is %s', ([_name, header]) => {
    expect(parseRetryAfterMs(header, NOW)).toBeUndefined()
  })
})

describe('retryDelayMs', () => {
  const decide = (
    overrides: Partial<Parameters<typeof retryDelayMs>[0]> = {}
  ) =>
    retryDelayMs({
      method: 'GET',
      status: 503,
      readRetryAfter: () => null,
      attempt: 1,
      random: () => 1,
      now: () => NOW,
      ...overrides
    })

  it.for([429, 502, 503, 504])('retries status %i', (status) => {
    expect(decide({ status })).toBeDefined()
  })

  it.for([200, 400, 401, 403, 404, 409, 500, 501])(
    'does not retry status %i',
    (status) => {
      expect(decide({ status })).toBeUndefined()
    }
  )

  it.for(['GET', 'get', 'HEAD', 'OPTIONS'])('retries %s', (method) => {
    expect(decide({ method })).toBeDefined()
  })

  it.for(['POST', 'PUT', 'PATCH', 'DELETE'])(
    'does not retry %s by default',
    (method) => {
      expect(decide({ method })).toBeUndefined()
    }
  )

  it('retries a non-idempotent method when the policy opts in', () => {
    const policy: RetryPolicy = {
      ...DEFAULT_RETRY_POLICY,
      retryNonIdempotent: true
    }
    expect(decide({ method: 'POST', policy })).toBeDefined()
  })

  it('stops once the attempts are spent', () => {
    const { maxAttempts } = DEFAULT_RETRY_POLICY
    expect(decide({ attempt: maxAttempts - 1 })).toBeDefined()
    expect(decide({ attempt: maxAttempts })).toBeUndefined()
  })

  it('backs off exponentially up to the cap', () => {
    const policy: RetryPolicy = {
      maxAttempts: 10,
      baseDelayMs: 100,
      maxDelayMs: 500,
      retryNonIdempotent: false
    }
    const delays = [1, 2, 3, 4, 5].map((attempt) =>
      decide({ attempt, policy, random: () => 1 })
    )
    expect(delays).toEqual([100, 200, 400, 500, 500])
  })

  it.for([0, 0.25, 0.5, 0.99, 1])(
    'keeps jitter within half to full backoff (random=%f)',
    (random) => {
      const delay = decide({ attempt: 2, random: () => random })
      const backoff = DEFAULT_RETRY_POLICY.baseDelayMs * 2
      expect(delay).toBeGreaterThanOrEqual(backoff / 2)
      expect(delay).toBeLessThanOrEqual(backoff)
    }
  )

  it('waits at least as long as Retry-After asks', () => {
    expect(decide({ readRetryAfter: () => '4' })).toBe(4_000)
  })

  it('reads an HTTP-date Retry-After against the clock', () => {
    expect(
      decide({ readRetryAfter: () => 'Sun, 18 Oct 2026 12:00:03 GMT' })
    ).toBe(3_000)
  })

  it('gives up when Retry-After exceeds the cap', () => {
    const tooLong = String(DEFAULT_RETRY_POLICY.maxDelayMs / 1000 + 1)
    expect(decide({ readRetryAfter: () => tooLong })).toBeUndefined()
  })

  it('accepts Retry-After exactly at the cap', () => {
    const atCap = String(DEFAULT_RETRY_POLICY.maxDelayMs / 1000)
    expect(decide({ readRetryAfter: () => atCap })).toBe(
      DEFAULT_RETRY_POLICY.maxDelayMs
    )
  })

  it('does not read the header for a response it will not retry', () => {
    const readRetryAfter = vi.fn(() => '1')
    decide({ status: 500, readRetryAfter })
    decide({ method: 'POST', readRetryAfter })
    expect(readRetryAfter).not.toHaveBeenCalled()
  })
})

describe('sleep', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  it('resolves after the delay', async () => {
    let settled = false
    const pending = sleep(1_000).then(() => {
      settled = true
    })

    await vi.advanceTimersByTimeAsync(999)
    expect(settled).toBe(false)
    await vi.advanceTimersByTimeAsync(1)
    await pending
    expect(settled).toBe(true)
  })

  it('rejects with the abort reason when aborted mid-wait', async () => {
    const controller = new AbortController()
    const pending = sleep(1_000, controller.signal)
    const outcome = pending.catch((reason: unknown) => reason)

    controller.abort('stop')

    expect(await outcome).toBe('stop')
    expect(vi.getTimerCount()).toBe(0)
  })

  it('rejects immediately when already aborted', async () => {
    const controller = new AbortController()
    controller.abort('stop')

    await expect(sleep(1_000, controller.signal)).rejects.toBe('stop')
  })
})
