import { beforeEach, describe, expect, it, vi } from 'vitest'

import { fetchWithRetry } from '@/utils/fetchWithRetry'
import { DEFAULT_RETRY_POLICY } from '@/utils/retryPolicy'

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

  it('waits the Retry-After the server sent', async () => {
    const fetchImpl = scriptedFetch(
      respond(503, { 'Retry-After': '4' }),
      respond(200)
    )

    await fetchWithRetry('https://api/x', {}, { fetchImpl, sleep, random })

    expect(sleep).toHaveBeenCalledExactlyOnceWith(4_000, undefined)
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

      const pending = fetchWithRetry('https://api/x', {}, { fetchImpl })

      await vi.advanceTimersByTimeAsync(2_999)
      expect(fetchImpl).toHaveBeenCalledTimes(1)
      await vi.advanceTimersByTimeAsync(1)
      expect((await pending).status).toBe(200)
      expect(fetchImpl).toHaveBeenCalledTimes(2)
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
