import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { RetryPolicy } from './retryPolicy'
import {
  DEFAULT_RETRY_POLICY,
  NO_RETRY_POLICY,
  isSignInCheckRefusal,
  nextRetry,
  parseRetryAfterMs,
  signInRefusalDelayMs,
  sleep,
  withSignInRefusalRetry
} from './retryPolicy'

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

describe('nextRetry delay', () => {
  const scheduledDelayMs = (
    overrides: Partial<Parameters<typeof nextRetry>[0]> = {}
  ) => {
    const decision = nextRetry({
      method: 'GET',
      status: 503,
      readRetryAfter: () => null,
      attempt: 1,
      random: () => 1,
      now: () => NOW,
      ...overrides
    })
    return decision.retry ? decision.delayMs : undefined
  }

  it.for([429, 502, 503, 504])('retries status %i', (status) => {
    expect(scheduledDelayMs({ status })).toBeDefined()
  })

  it.for([200, 400, 401, 403, 404, 409, 500, 501])(
    'does not retry status %i',
    (status) => {
      expect(scheduledDelayMs({ status })).toBeUndefined()
    }
  )

  it.for(['GET', 'get', 'HEAD', 'OPTIONS'])('retries %s', (method) => {
    expect(scheduledDelayMs({ method })).toBeDefined()
  })

  it.for(['POST', 'PUT', 'PATCH', 'DELETE'])(
    'does not retry %s by default',
    (method) => {
      expect(scheduledDelayMs({ method })).toBeUndefined()
    }
  )

  it('retries a non-idempotent method when the policy opts in', () => {
    const policy: RetryPolicy = {
      ...DEFAULT_RETRY_POLICY,
      retryNonIdempotent: true
    }
    expect(scheduledDelayMs({ method: 'POST', policy })).toBeDefined()
  })

  it('stops once the attempts are spent', () => {
    const { maxAttempts } = DEFAULT_RETRY_POLICY
    expect(scheduledDelayMs({ attempt: maxAttempts - 1 })).toBeDefined()
    expect(scheduledDelayMs({ attempt: maxAttempts })).toBeUndefined()
  })

  it('backs off exponentially up to the cap', () => {
    const policy: RetryPolicy = {
      maxAttempts: 10,
      baseDelayMs: 100,
      maxDelayMs: 500,
      retryNonIdempotent: false,
      retrySignInRefusal: false
    }
    const delays = [1, 2, 3, 4, 5].map((attempt) =>
      scheduledDelayMs({ attempt, policy, random: () => 1 })
    )
    expect(delays).toEqual([100, 200, 400, 500, 500])
  })

  it.for([0, 0.25, 0.5, 0.99, 1])(
    'keeps jitter within half to full backoff (random=%f)',
    (random) => {
      const delay = scheduledDelayMs({ attempt: 2, random: () => random })
      const backoff = DEFAULT_RETRY_POLICY.baseDelayMs * 2
      expect(delay).toBeGreaterThanOrEqual(backoff / 2)
      expect(delay).toBeLessThanOrEqual(backoff)
    }
  )

  it.for([
    [0, 4_000],
    [1, 4_250]
  ])(
    'adds jitter on top of Retry-After, never below it (random=%f)',
    ([random, expected]) => {
      expect(
        scheduledDelayMs({ readRetryAfter: () => '4', random: () => random })
      ).toBe(expected)
    }
  )

  it('reads an HTTP-date Retry-After against the clock', () => {
    expect(
      scheduledDelayMs({
        readRetryAfter: () => 'Sun, 18 Oct 2026 12:00:03 GMT',
        random: () => 0
      })
    ).toBe(3_000)
  })

  it('gives up when Retry-After exceeds the cap', () => {
    const tooLong = String(DEFAULT_RETRY_POLICY.maxDelayMs / 1000 + 1)
    expect(scheduledDelayMs({ readRetryAfter: () => tooLong })).toBeUndefined()
  })

  it('accepts Retry-After exactly at the cap', () => {
    const atCap = String(DEFAULT_RETRY_POLICY.maxDelayMs / 1000)
    expect(scheduledDelayMs({ readRetryAfter: () => atCap })).toBe(
      DEFAULT_RETRY_POLICY.maxDelayMs
    )
  })

  it('does not read the header for a response it will not retry', () => {
    const readRetryAfter = vi.fn(() => '1')
    scheduledDelayMs({ status: 500, readRetryAfter })
    scheduledDelayMs({ method: 'POST', readRetryAfter })
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

describe('nextRetry', () => {
  const decide = (overrides: Partial<Parameters<typeof nextRetry>[0]> = {}) =>
    nextRetry({
      method: 'GET',
      status: 503,
      readRetryAfter: () => null,
      attempt: 1,
      random: () => 1,
      now: () => NOW,
      ...overrides
    })

  it.for<[string, Partial<Parameters<typeof nextRetry>[0]>, string]>([
    ['a non-retryable status', { status: 500 }, 'not_retryable'],
    ['a write', { method: 'POST' }, 'not_retryable'],
    ['the last attempt', { attempt: 3 }, 'attempts_spent'],
    ['a no-retry policy', { policy: NO_RETRY_POLICY }, 'attempts_spent'],
    [
      'a Retry-After past the cap',
      { readRetryAfter: () => '30' },
      'retry_after_too_long'
    ]
  ])('stops on %s and says why', ([_name, overrides, reason]) => {
    expect(decide(overrides)).toEqual({ retry: false, reason })
  })

  it('schedules the next attempt after the backoff delay', () => {
    expect(decide()).toEqual({ retry: true, delayMs: 500 })
  })
})

describe('isSignInCheckRefusal', () => {
  const refusal = {
    code: 'unavailable',
    message: 'authentication service unavailable'
  }

  const matches = (
    overrides: Partial<Parameters<typeof isSignInCheckRefusal>[0]> = {}
  ) =>
    isSignInCheckRefusal({
      status: 503,
      readRetryAfter: () => '5',
      readBody: () => refusal,
      ...overrides
    })

  it('matches the sign-in check 503 with a parsed body', async () => {
    expect(await matches()).toBe(true)
  })

  it('matches the same body as JSON text', async () => {
    expect(await matches({ readBody: () => JSON.stringify(refusal) })).toBe(
      true
    )
  })

  it('matches a body read asynchronously', async () => {
    expect(await matches({ readBody: async () => refusal })).toBe(true)
  })

  it.for<[string, Partial<Parameters<typeof isSignInCheckRefusal>[0]>]>([
    ['another status', { status: 502 }],
    ['no Retry-After', { readRetryAfter: () => null }],
    ['an unreadable Retry-After', { readRetryAfter: () => 'soon' }],
    [
      'another service message',
      { readBody: () => ({ message: 'agent service unavailable' }) }
    ],
    ['a body without a message', { readBody: () => ({ code: 'x' }) }],
    ['a body that is not JSON', { readBody: () => 'Service Unavailable' }],
    ['an empty body', { readBody: () => undefined }],
    [
      'a body that fails to read',
      { readBody: () => Promise.reject(new SyntaxError('bad json')) }
    ]
  ])('does not match %s', async ([_name, overrides]) => {
    expect(await matches(overrides)).toBe(false)
  })

  it('does not match a body that never finishes', async () => {
    vi.useFakeTimers()
    const settled = vi.fn()

    void matches({ readBody: () => new Promise(() => {}) }).then(settled)
    await vi.advanceTimersByTimeAsync(1_000)

    expect(settled).toHaveBeenCalledExactlyOnceWith(false)
  })

  it('leaves no timer behind once the body is read', async () => {
    vi.useFakeTimers()

    expect(await matches()).toBe(true)
    expect(vi.getTimerCount()).toBe(0)
  })

  it('reads neither header nor body for another status', async () => {
    const readRetryAfter = vi.fn(() => '5')
    const readBody = vi.fn(() => refusal)

    await matches({ status: 500, readRetryAfter, readBody })

    expect(readRetryAfter).not.toHaveBeenCalled()
    expect(readBody).not.toHaveBeenCalled()
  })
})

describe('nextRetry after a sign-in check refusal', () => {
  const decide = (overrides: Partial<Parameters<typeof nextRetry>[0]> = {}) =>
    nextRetry({
      method: 'POST',
      status: 503,
      readRetryAfter: () => '5',
      attempt: 1,
      random: () => 0,
      now: () => NOW,
      policy: withSignInRefusalRetry(),
      signInRefusal: true,
      ...overrides
    })

  it.for(['POST', 'PUT', 'PATCH', 'DELETE'])(
    'sends a %s once more after the Retry-After wait',
    (method) => {
      expect(decide({ method })).toEqual({ retry: true, delayMs: 5_000 })
    }
  )

  it('stops a write after its one extra attempt', () => {
    expect(decide({ attempt: 2 })).toEqual({
      retry: false,
      reason: 'attempts_spent'
    })
  })

  it('gives up when Retry-After exceeds the cap', () => {
    expect(decide({ readRetryAfter: () => '30' })).toEqual({
      retry: false,
      reason: 'retry_after_too_long'
    })
  })

  it('does not send a write again when the policy does not opt in', () => {
    expect(decide({ policy: DEFAULT_RETRY_POLICY })).toEqual({
      retry: false,
      reason: 'not_retryable'
    })
  })

  it('keeps the no-retry policy at one attempt', () => {
    expect(decide({ policy: withSignInRefusalRetry(NO_RETRY_POLICY) })).toEqual(
      {
        retry: false,
        reason: 'attempts_spent'
      }
    )
  })

  it('keeps the full attempt budget for a GET', () => {
    expect(decide({ method: 'GET', attempt: 2 }).retry).toBe(true)
  })
})

describe('signInRefusalDelayMs', () => {
  const refusalBody = { message: 'authentication service unavailable' }

  const delayFor = (
    overrides: Partial<Parameters<typeof signInRefusalDelayMs>[0]> = {}
  ) =>
    signInRefusalDelayMs({
      method: 'POST',
      status: 503,
      readRetryAfter: () => '5',
      readBody: () => refusalBody,
      policy: withSignInRefusalRetry(),
      random: () => 0,
      ...overrides
    })

  it('waits the Retry-After for a refused write the policy opts in', async () => {
    expect(await delayFor()).toBe(5_000)
  })

  it.for<[string, Partial<Parameters<typeof signInRefusalDelayMs>[0]>]>([
    ['the default policy', { policy: DEFAULT_RETRY_POLICY }],
    ['a GET', { method: 'GET' }],
    ['a 200', { status: 200 }],
    ['a 503 with no Retry-After', { readRetryAfter: () => null }],
    ['a Retry-After past the cap', { readRetryAfter: () => '30' }],
    [
      'a policy with no send left',
      { policy: withSignInRefusalRetry(NO_RETRY_POLICY) }
    ]
  ])('reads no body for %s', async ([_name, overrides]) => {
    const readBody = vi.fn(() => refusalBody)

    expect(await delayFor({ ...overrides, readBody })).toBeUndefined()
    expect(readBody).not.toHaveBeenCalled()
  })

  it('sends nothing more when Retry-After is past the cap', async () => {
    expect(await delayFor({ readRetryAfter: () => '30' })).toBeUndefined()
  })
})
