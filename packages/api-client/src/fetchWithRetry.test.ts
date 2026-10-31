import { beforeEach, describe, expect, it, vi } from 'vitest'

import { useTelemetry } from '@comfyorg/telemetry'

import { fetchWithRetry } from './fetchWithRetry'
import {
  DEFAULT_RETRY_POLICY,
  NO_RETRY_POLICY,
  withSignInRefusalRetry
} from './retryPolicy'
import { clearStatusRetryBudget } from './statusRetryTelemetry'

vi.mock(import('@comfyorg/telemetry'))

function respond(status: number, headers: Record<string, string> = {}) {
  return new Response(status === 200 ? '{}' : null, { status, headers })
}

function scriptedFetch(...responses: Response[]) {
  const queue = [...responses]
  return vi.fn<typeof fetch>(async () => {
    const next = queue.shift()
    if (!next) throw new Error('fetch called more times than scripted')
    return next
  })
}

describe('fetchWithRetry', () => {
  const sleep = vi.fn<(ms: number) => Promise<void>>(async () => {})
  const random = () => 1

  it('returns a 200 after one 503', async () => {
    const final = respond(200)
    const fetchImpl = scriptedFetch(respond(503), final)

    const result = await fetchWithRetry(
      'https://api/x',
      {},
      { fetchImpl, sleep, random }
    )

    expect(result).toBe(final)
    expect(fetchImpl).toHaveBeenCalledTimes(2)
  })

  it('returns the final 503 once the attempts are spent', async () => {
    const last = respond(503)
    const fetchImpl = scriptedFetch(respond(503), respond(503), last)

    const result = await fetchWithRetry(
      'https://api/x',
      {},
      { fetchImpl, sleep, random }
    )

    expect(result).toBe(last)
    expect(fetchImpl).toHaveBeenCalledTimes(DEFAULT_RETRY_POLICY.maxAttempts)
  })

  it.for([400, 401, 404, 500])('does not retry a %i', async (status) => {
    const fetchImpl = scriptedFetch(respond(status))

    const result = await fetchWithRetry(
      'https://api/x',
      {},
      { fetchImpl, sleep, random }
    )

    expect(result.status).toBe(status)
    expect(fetchImpl).toHaveBeenCalledTimes(1)
  })

  it.for(['POST', 'PUT', 'PATCH', 'DELETE'])(
    'does not retry a %s that got a 503',
    async (method) => {
      const fetchImpl = scriptedFetch(respond(503))

      const result = await fetchWithRetry(
        'https://api/x',
        { method },
        { fetchImpl, sleep, random }
      )

      expect(result.status).toBe(503)
      expect(fetchImpl).toHaveBeenCalledTimes(1)
    }
  )

  it('does not retry a Request whose method is not idempotent', async () => {
    const fetchImpl = scriptedFetch(respond(503))

    await fetchWithRetry(
      new Request('https://api/x', { method: 'POST', body: '{}' }),
      {},
      { fetchImpl, sleep, random }
    )

    expect(fetchImpl).toHaveBeenCalledTimes(1)
  })

  describe('replaying a body', () => {
    const optedIn = { ...DEFAULT_RETRY_POLICY, retryNonIdempotent: true }

    function consumingFetch(...responses: Response[]) {
      const bodies: string[] = []
      const queue = [...responses]
      const fetchImpl = vi.fn<typeof fetch>(async (input, init) => {
        const sent = input instanceof Request ? input : new Request(input, init)
        bodies.push(await sent.text())
        const next = queue.shift()
        if (!next) throw new Error('fetch called more times than scripted')
        return next
      })
      return { fetchImpl, bodies }
    }

    it('sends the body of a Request again on the second attempt', async () => {
      const { fetchImpl, bodies } = consumingFetch(respond(503), respond(200))

      const result = await fetchWithRetry(
        new Request('https://api/x', { method: 'POST', body: 'payload' }),
        {},
        { fetchImpl, sleep, random, policy: optedIn }
      )

      expect(result.status).toBe(200)
      expect(bodies).toEqual(['payload', 'payload'])
    })

    it('sends an init body again on the second attempt', async () => {
      const { fetchImpl, bodies } = consumingFetch(respond(503), respond(200))

      await fetchWithRetry(
        'https://api/x',
        { method: 'POST', body: 'payload' },
        { fetchImpl, sleep, random, policy: optedIn }
      )

      expect(bodies).toEqual(['payload', 'payload'])
    })

    it('leaves the caller request unconsumed', async () => {
      const { fetchImpl } = consumingFetch(respond(503), respond(200))
      const request = new Request('https://api/x', {
        method: 'POST',
        body: 'payload'
      })

      await fetchWithRetry(
        request,
        {},
        { fetchImpl, sleep, random, policy: optedIn }
      )

      expect(request.bodyUsed).toBe(false)
    })

    it('does not retry a stream body that cannot be replayed', async () => {
      const fetchImpl = scriptedFetch(respond(503))
      const body = new ReadableStream<Uint8Array>()

      const result = await fetchWithRetry(
        'https://api/x',
        { method: 'POST', body, duplex: 'half' } as RequestInit,
        { fetchImpl, sleep, random, policy: optedIn }
      )

      expect(result.status).toBe(503)
      expect(fetchImpl).toHaveBeenCalledTimes(1)
    })
  })

  it('retries a POST only when the policy opts in', async () => {
    const fetchImpl = scriptedFetch(respond(503), respond(200))

    const result = await fetchWithRetry(
      'https://api/x',
      { method: 'POST' },
      {
        fetchImpl,
        sleep,
        random,
        policy: { ...DEFAULT_RETRY_POLICY, retryNonIdempotent: true }
      }
    )

    expect(result.status).toBe(200)
    expect(fetchImpl).toHaveBeenCalledTimes(2)
  })

  describe('a write the sign-in check refused', () => {
    const AUTH_UNAVAILABLE = 'authentication service unavailable'
    const policy = withSignInRefusalRetry()
    const tracked = () => vi.mocked(useTelemetry()!.trackFetchStatusRetry)

    beforeEach(() => clearStatusRetryBudget())

    function refusal(
      message = AUTH_UNAVAILABLE,
      headers: Record<string, string> = { 'Retry-After': '5' }
    ) {
      return new Response(JSON.stringify({ code: 'unavailable', message }), {
        status: 503,
        headers: { 'Content-Type': 'application/json', ...headers }
      })
    }

    it('is sent once under the default policy', async () => {
      const answer = refusal()
      const fetchImpl = scriptedFetch(answer)

      const result = await fetchWithRetry(
        'https://api/x',
        { method: 'POST', body: '{}' },
        { fetchImpl, sleep, random }
      )

      expect(result).toBe(answer)
      expect(fetchImpl).toHaveBeenCalledTimes(1)
      expect(sleep).not.toHaveBeenCalled()
    })

    it('sends a write that succeeds once, as given, with no telemetry', async () => {
      const final = respond(200)
      const fetchImpl = scriptedFetch(final)
      const request = new Request('https://api.comfy.org/x', {
        method: 'POST',
        body: '{}'
      })
      const init = {}

      const result = await fetchWithRetry(request, init, {
        fetchImpl,
        sleep,
        random,
        policy
      })

      expect(result).toBe(final)
      expect(fetchImpl).toHaveBeenCalledOnce()
      expect(fetchImpl.mock.calls[0][0]).toBe(request)
      expect(fetchImpl.mock.calls[0][1]).toBe(init)
      expect(tracked()).not.toHaveBeenCalled()
    })

    it.for(['POST', 'PUT', 'PATCH', 'DELETE'])(
      'sends a %s once more and returns the success',
      async (method) => {
        const final = respond(200)
        const fetchImpl = scriptedFetch(refusal(), final)

        const result = await fetchWithRetry(
          'https://api/x',
          { method, body: '{}' },
          { fetchImpl, sleep, random, policy }
        )

        expect(result).toBe(final)
        expect(fetchImpl).toHaveBeenCalledTimes(2)
        expect(sleep).toHaveBeenCalledExactlyOnceWith(5_250, undefined)
      }
    )

    it('records the write it sent twice', async () => {
      const fetchImpl = scriptedFetch(refusal(), respond(200))

      await fetchWithRetry(
        'https://api.comfy.org/customers/balance',
        { method: 'POST', body: '{}' },
        { fetchImpl, sleep, random, policy }
      )

      expect(tracked()).toHaveBeenCalledExactlyOnceWith(
        expect.objectContaining({
          method: 'POST',
          attempts: 2,
          final_status: 200,
          outcome: 'recovered'
        })
      )
    })

    it('returns the second refusal after exactly two sends', async () => {
      const last = refusal()
      const fetchImpl = scriptedFetch(refusal(), last)

      const result = await fetchWithRetry(
        'https://api/x',
        { method: 'POST', body: '{}' },
        { fetchImpl, sleep, random, policy }
      )

      expect(result).toBe(last)
      expect(fetchImpl).toHaveBeenCalledTimes(2)
      expect(await result.json()).toEqual({
        code: 'unavailable',
        message: AUTH_UNAVAILABLE
      })
    })

    it.for<[string, () => Response]>([
      ['has no Retry-After', () => refusal(AUTH_UNAVAILABLE, {})],
      ['names another service', () => refusal('agent service unavailable')],
      [
        'has a body that is not JSON',
        () =>
          new Response('Service Unavailable', {
            status: 503,
            headers: { 'Retry-After': '5' }
          })
      ],
      [
        'asks for a Retry-After past the cap',
        () => refusal(AUTH_UNAVAILABLE, { 'Retry-After': '3600' })
      ]
    ])('does not send a POST again when the 503 %s', async ([_name, make]) => {
      const answer = make()
      const fetchImpl = scriptedFetch(answer)

      const result = await fetchWithRetry(
        'https://api/x',
        { method: 'POST', body: '{}' },
        { fetchImpl, sleep, random, policy }
      )

      expect(result).toBe(answer)
      expect(fetchImpl).toHaveBeenCalledTimes(1)
      expect(sleep).not.toHaveBeenCalled()
      expect(tracked()).not.toHaveBeenCalled()
    })

    it('sends the body of a Request again', async () => {
      const bodies: string[] = []
      const queue = [refusal(), respond(200)]
      const fetchImpl = vi.fn<typeof fetch>(async (input, init) => {
        const sent = input instanceof Request ? input : new Request(input, init)
        bodies.push(await sent.text())
        const next = queue.shift()
        if (!next) throw new Error('fetch called more times than scripted')
        return next
      })

      const result = await fetchWithRetry(
        new Request('https://api/x', { method: 'POST', body: 'payload' }),
        {},
        { fetchImpl, sleep, random, policy }
      )

      expect(result.status).toBe(200)
      expect(bodies).toEqual(['payload', 'payload'])
    })

    it('does not send a stream body again', async () => {
      const fetchImpl = scriptedFetch(refusal())
      const body = new ReadableStream<Uint8Array>()

      const result = await fetchWithRetry(
        'https://api/x',
        { method: 'POST', body, duplex: 'half' } as RequestInit,
        { fetchImpl, sleep, random, policy }
      )

      expect(result.status).toBe(503)
      expect(fetchImpl).toHaveBeenCalledTimes(1)
    })

    it('keeps the full retry budget for a GET', async () => {
      const fetchImpl = scriptedFetch(refusal(), refusal(), refusal())

      await fetchWithRetry(
        'https://api/x',
        {},
        { fetchImpl, sleep, random, policy }
      )

      expect(fetchImpl).toHaveBeenCalledTimes(DEFAULT_RETRY_POLICY.maxAttempts)
    })

    function refusalWithUnfinishedBody(retryAfter: string) {
      const partial = new TextEncoder().encode('{"message":')
      return new Response(
        new ReadableStream<Uint8Array>({
          start: (controller) => controller.enqueue(partial)
        }),
        { status: 503, headers: { 'Retry-After': retryAfter } }
      )
    }

    it('returns a 503 past the cap at its headers, leaving an unfinished body unread', async () => {
      vi.useFakeTimers()
      const answer = refusalWithUnfinishedBody('3600')
      const fetchImpl = scriptedFetch(answer)
      const settled = vi.fn()

      void fetchWithRetry(
        'https://api/x',
        { method: 'POST', body: '{}' },
        { fetchImpl, sleep, random, policy }
      ).then(settled)
      await vi.advanceTimersByTimeAsync(0)

      expect(settled).toHaveBeenCalledExactlyOnceWith(answer)
      expect(fetchImpl).toHaveBeenCalledOnce()
    })

    it('returns a refusal-shaped 503 whose body stalls, without sending it again', async () => {
      vi.useFakeTimers()
      const answer = refusalWithUnfinishedBody('5')
      const fetchImpl = scriptedFetch(answer)
      const settled = vi.fn()

      void fetchWithRetry(
        'https://api/x',
        { method: 'POST', body: '{}' },
        { fetchImpl, sleep, random, policy }
      ).then(settled)
      await vi.advanceTimersByTimeAsync(1_000)

      expect(settled).toHaveBeenCalledExactlyOnceWith(answer)
      expect(fetchImpl).toHaveBeenCalledOnce()
      expect(sleep).not.toHaveBeenCalled()
    })

    it('sends nothing more when the signal aborts during the wait', async () => {
      vi.useFakeTimers()
      const fetchImpl = scriptedFetch(refusal(), respond(200))
      const controller = new AbortController()
      const timeout = new DOMException('Fetch timeout', 'TimeoutError')

      const outcome = fetchWithRetry(
        'https://api/x',
        { method: 'POST', body: '{}', signal: controller.signal },
        { fetchImpl, random, policy }
      ).catch((error: unknown) => error)
      await vi.advanceTimersByTimeAsync(1_000)
      controller.abort(timeout)
      await vi.advanceTimersByTimeAsync(10_000)

      expect(await outcome).toBe(timeout)
      expect(fetchImpl).toHaveBeenCalledOnce()
    })

    it('records one send and the first 503 when its timeout fires during the wait', async () => {
      const controller = new AbortController()
      const timeout = new DOMException('Fetch timeout', 'TimeoutError')
      const fetchImpl = scriptedFetch(refusal(), respond(200))
      const sleepUntilTimeout = vi.fn(async () => {
        controller.abort(timeout)
        throw timeout
      })

      await expect(
        fetchWithRetry(
          'https://api.comfy.org/customers/balance',
          { method: 'POST', body: '{}', signal: controller.signal },
          { fetchImpl, sleep: sleepUntilTimeout, random, policy }
        )
      ).rejects.toBe(timeout)

      expect(fetchImpl).toHaveBeenCalledOnce()
      expect(tracked()).toHaveBeenCalledExactlyOnceWith(
        expect.objectContaining({
          method: 'POST',
          attempts: 1,
          final_status: 503,
          outcome: 'timeout_budget'
        })
      )
    })

    it('waits the Retry-After before sending again', async () => {
      vi.useFakeTimers()
      const fetchImpl = scriptedFetch(refusal(), respond(200))

      const pending = fetchWithRetry(
        'https://api/x',
        { method: 'POST', body: '{}' },
        { fetchImpl, random, policy }
      )

      await vi.advanceTimersByTimeAsync(5_249)
      expect(fetchImpl).toHaveBeenCalledTimes(1)
      await vi.advanceTimersByTimeAsync(1)
      expect((await pending).status).toBe(200)
      expect(fetchImpl).toHaveBeenCalledTimes(2)
    })
  })

  it('waits the Retry-After the server sent', async () => {
    const fetchImpl = scriptedFetch(
      respond(503, { 'Retry-After': '4' }),
      respond(200)
    )

    await fetchWithRetry('https://api/x', {}, { fetchImpl, sleep, random })

    expect(sleep).toHaveBeenCalledExactlyOnceWith(4_250, undefined)
  })

  it('returns the 503 without waiting when Retry-After is past the cap', async () => {
    const fetchImpl = scriptedFetch(respond(503, { 'Retry-After': '3600' }))

    const result = await fetchWithRetry(
      'https://api/x',
      {},
      { fetchImpl, sleep, random }
    )

    expect(result.status).toBe(503)
    expect(fetchImpl).toHaveBeenCalledTimes(1)
    expect(sleep).not.toHaveBeenCalled()
  })

  describe('with the real clock source', () => {
    beforeEach(() => {
      vi.useFakeTimers()
    })

    it('holds the retry back until Retry-After has elapsed', async () => {
      const fetchImpl = scriptedFetch(
        respond(503, { 'Retry-After': '3' }),
        respond(200)
      )

      const pending = fetchWithRetry('https://api/x', {}, { fetchImpl, random })

      await vi.advanceTimersByTimeAsync(3_249)
      expect(fetchImpl).toHaveBeenCalledTimes(1)
      await vi.advanceTimersByTimeAsync(1)
      expect((await pending).status).toBe(200)
      expect(fetchImpl).toHaveBeenCalledTimes(2)
    })

    it('rejects with the timeout reason when the timeout signal fires mid-wait', async () => {
      const controller = new AbortController()
      const fetchImpl = scriptedFetch(respond(503, { 'Retry-After': '5' }))
      const timeout = new DOMException('Fetch timeout', 'TimeoutError')

      const pending = fetchWithRetry(
        'https://api/x',
        { signal: controller.signal },
        { fetchImpl }
      )
      const outcome = pending.catch((reason: unknown) => reason)
      await vi.advanceTimersByTimeAsync(1_000)
      controller.abort(timeout)

      expect(await outcome).toBe(timeout)
      expect(fetchImpl).toHaveBeenCalledTimes(1)
    })

    it('rejects when the signal was already aborted before the wait began', async () => {
      const controller = new AbortController()
      const fetchImpl = vi.fn(async () => {
        controller.abort('gone')
        return respond(503)
      })

      await expect(
        fetchWithRetry(
          'https://api/x',
          { signal: controller.signal },
          { fetchImpl }
        )
      ).rejects.toBe('gone')
      expect(fetchImpl).toHaveBeenCalledTimes(1)
    })

    it('stops waiting when the caller aborts', async () => {
      const controller = new AbortController()
      const fetchImpl = scriptedFetch(respond(503, { 'Retry-After': '5' }))

      const pending = fetchWithRetry(
        'https://api/x',
        { signal: controller.signal },
        { fetchImpl }
      )
      const outcome = pending.catch((reason: unknown) => reason)
      await vi.advanceTimersByTimeAsync(1_000)
      controller.abort('cancelled')

      expect(await outcome).toBe('cancelled')
      expect(fetchImpl).toHaveBeenCalledTimes(1)
    })
  })
})

describe('fetchWithRetry status retry telemetry', () => {
  const sleep = vi.fn<(ms: number) => Promise<void>>(async () => {})
  const random = () => 1
  const balanceUrl = 'https://api.comfy.org/customers/balance'
  const tracked = () => vi.mocked(useTelemetry()!.trackFetchStatusRetry)

  beforeEach(() => clearStatusRetryBudget())

  it('records a request that recovered after a retry', async () => {
    const fetchImpl = scriptedFetch(respond(503), respond(200))

    await fetchWithRetry(balanceUrl, {}, { fetchImpl, sleep, random })

    expect(tracked()).toHaveBeenCalledExactlyOnceWith({
      transport: 'fetch',
      method: 'GET',
      host: 'api.comfy.org',
      route: '/customers/:resource',
      attempts: 2,
      final_status: 200,
      outcome: 'recovered'
    })
  })

  it.for<[string, Response[], Record<string, unknown>]>([
    [
      'spent its attempts',
      [respond(503), respond(502), respond(503)],
      { attempts: 3, final_status: 503, outcome: 'exhausted' }
    ],
    [
      'gave up because Retry-After was too long',
      [respond(503, { 'Retry-After': '30' })],
      { attempts: 1, final_status: 503, outcome: 'retry_after_too_long' }
    ],
    [
      'got a non-retryable error after a retry',
      [respond(503), respond(500)],
      { attempts: 2, final_status: 500, outcome: 'failed' }
    ]
  ])('records a request that %s', async ([_name, responses, expected]) => {
    const fetchImpl = scriptedFetch(...responses)

    await fetchWithRetry(balanceUrl, {}, { fetchImpl, sleep, random })

    expect(tracked()).toHaveBeenCalledExactlyOnceWith(
      expect.objectContaining(expected)
    )
  })

  it('records a retry that got no response and still rethrows the failure', async () => {
    const failure = new TypeError('Failed to fetch')
    const fetchImpl = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(respond(503))
      .mockRejectedValueOnce(failure)

    await expect(
      fetchWithRetry(balanceUrl, {}, { fetchImpl, sleep, random })
    ).rejects.toBe(failure)

    expect(tracked()).toHaveBeenCalledExactlyOnceWith(
      expect.objectContaining({
        attempts: 2,
        final_status: 503,
        outcome: 'failed'
      })
    )
  })

  it('records a request whose timeout fired while it waited to retry', async () => {
    const controller = new AbortController()
    const timeout = new DOMException('Fetch timeout', 'TimeoutError')
    const fetchImpl = scriptedFetch(respond(503))
    const sleepUntilTimeout = vi.fn(async () => {
      controller.abort(timeout)
      throw timeout
    })

    await expect(
      fetchWithRetry(
        balanceUrl,
        { signal: controller.signal },
        { fetchImpl, sleep: sleepUntilTimeout, random }
      )
    ).rejects.toBe(timeout)

    expect(tracked()).toHaveBeenCalledExactlyOnceWith(
      expect.objectContaining({
        attempts: 1,
        final_status: 503,
        outcome: 'timeout_budget'
      })
    )
  })

  it('records nothing when the caller cancels while it waits to retry', async () => {
    const controller = new AbortController()
    const fetchImpl = scriptedFetch(respond(503))
    const sleepUntilCancel = vi.fn(async () => {
      controller.abort('route changed')
      throw 'route changed'
    })

    await expect(
      fetchWithRetry(
        balanceUrl,
        { signal: controller.signal },
        { fetchImpl, sleep: sleepUntilCancel, random }
      )
    ).rejects.toBe('route changed')

    expect(tracked()).not.toHaveBeenCalled()
  })

  it.for([
    [
      'https://cloud.comfy.org/api/workspaces/ws_8f2a91/members?token=secret',
      '/workspaces/:resource'
    ],
    [
      'https://cloud.comfy.org/api/userdata/my-secret-project',
      '/userdata/:resource'
    ],
    ['https://cloud.comfy.org/api/someone/alice', '/other']
  ])('reports %s only by its route group', async ([url, route]) => {
    const fetchImpl = scriptedFetch(respond(503), respond(200))

    await fetchWithRetry(url, {}, { fetchImpl, sleep, random })

    expect(tracked()).toHaveBeenCalledExactlyOnceWith(
      expect.objectContaining({ host: 'cloud.comfy.org', route })
    )
  })

  it('records at most 20 events per route and outcome each minute', async () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    const recoverOnce = () =>
      fetchWithRetry(
        'https://cloud.comfy.org/api/queue',
        {},
        { fetchImpl: scriptedFetch(respond(503), respond(200)), sleep, random }
      )

    await Promise.all(Array.from({ length: 25 }, recoverOnce))
    expect(tracked()).toHaveBeenCalledTimes(20)

    vi.advanceTimersByTime(60_000)
    await recoverOnce()

    expect(tracked()).toHaveBeenCalledTimes(21)
  })

  it('does not spend the budget before telemetry is ready', async () => {
    vi.mocked(useTelemetry).mockReturnValueOnce(null)
    await fetchWithRetry(
      balanceUrl,
      {},
      { fetchImpl: scriptedFetch(respond(503), respond(200)), sleep, random }
    )

    await fetchWithRetry(
      balanceUrl,
      {},
      { fetchImpl: scriptedFetch(respond(503), respond(200)), sleep, random }
    )

    expect(tracked()).toHaveBeenCalledOnce()
  })

  it('reports a host outside Comfy as other', async () => {
    const fetchImpl = scriptedFetch(respond(503), respond(200))

    await fetchWithRetry(
      'https://10.0.0.7:8443/api/queue',
      {},
      { fetchImpl, sleep, random }
    )

    expect(tracked()).toHaveBeenCalledExactlyOnceWith(
      expect.objectContaining({ host: 'other', route: '/queue' })
    )
  })

  it('still retries when discarding the retryable body fails', async () => {
    const broken = new Response(
      new ReadableStream({
        cancel: () => Promise.reject(new Error('stream errored'))
      }),
      { status: 503 }
    )
    const fetchImpl = scriptedFetch(broken, respond(200))

    const result = await fetchWithRetry(
      balanceUrl,
      {},
      { fetchImpl, sleep, random }
    )

    expect(result.status).toBe(200)
    expect(tracked()).toHaveBeenCalledWith(
      expect.objectContaining({ outcome: 'recovered' })
    )
  })

  it('records nothing for a request that never saw a retryable status', async () => {
    const fetchImpl = scriptedFetch(respond(500))

    await fetchWithRetry(balanceUrl, {}, { fetchImpl, sleep, random })

    expect(tracked()).not.toHaveBeenCalled()
  })

  it('records nothing for a read that opted out of the status retry', async () => {
    const fetchImpl = scriptedFetch(respond(503, { 'Retry-After': '30' }))

    await fetchWithRetry(
      balanceUrl,
      {},
      { policy: NO_RETRY_POLICY, fetchImpl, sleep, random }
    )

    expect(tracked()).not.toHaveBeenCalled()
  })
})
