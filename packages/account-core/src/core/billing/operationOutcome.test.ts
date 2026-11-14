import { fetchRequests, respondToFetch } from '@comfyorg/test-utils/fetch'
import { describe, expect, it, vi } from 'vitest'

import type { OperationOutcomeReadOptions } from './operationOutcome'
import { operationOutcomeRoute, readOperationOutcome } from './operationOutcome'

const OUTCOME_URL = 'https://cloud.test/api/billing/ops/op-1/outcome'

function read(overrides: Partial<OperationOutcomeReadOptions> = {}) {
  return readOperationOutcome({
    operationId: 'op-1',
    token: 'scoped-session-1',
    resolveUrl: (route) => `https://cloud.test/api${route}`,
    ...overrides
  })
}

function neverAnswering(): typeof fetch {
  return (_input, init) =>
    new Promise((_resolve, reject) => {
      init?.signal?.addEventListener('abort', () =>
        reject(new DOMException('aborted', 'AbortError'))
      )
    })
}

describe('operationOutcomeRoute', () => {
  it('names one operation, keeping an id with a slash in one path segment', () => {
    expect(operationOutcomeRoute('op/1')).toBe('/billing/ops/op%2F1/outcome')
  })
})

describe('readOperationOutcome', () => {
  it('asks for that operation with the bearer alone, sending no cookies and no body', async () => {
    respondToFetch(OUTCOME_URL, () => Response.json({ status: 'pending' }))

    await read()

    expect(fetch).toHaveBeenCalledTimes(1)
    const [url, init] = vi.mocked(fetch).mock.calls[0]
    expect(url).toBe(OUTCOME_URL)
    expect(init).toMatchObject({ method: 'GET', credentials: 'omit' })
    expect(init?.body).toBeUndefined()
    expect(fetchRequests()[0].headers.get('Authorization')).toBe(
      'Bearer scoped-session-1'
    )
  })

  it.for(['pending', 'succeeded', 'failed', 'reconciliation_needed'] as const)(
    'reports an operation Cloud calls %s',
    async (status) => {
      respondToFetch(OUTCOME_URL, () => Response.json({ status }))

      await expect(read()).resolves.toEqual({ kind: 'outcome', status })
    }
  )

  it.for([
    { status: 401, code: 'INVALID_CREDENTIAL' },
    { status: 403, code: 'HANDOFF_DISABLED' },
    { status: 404, code: 'NOT_FOUND' }
  ])('reads a $status $code as a refusal', async ({ status, code }) => {
    respondToFetch(OUTCOME_URL, () =>
      Response.json({ code, message: 'no' }, { status })
    )

    await expect(read()).resolves.toEqual({ kind: 'refused' })
  })

  it.for<{ name: string; answer: () => Response | Promise<Response> }>([
    {
      name: 'a server error',
      answer: () =>
        Response.json({ code: 'INTERNAL_ERROR', message: 'x' }, { status: 500 })
    },
    {
      name: 'a session check Cloud could not make',
      answer: () => new Response(null, { status: 503 })
    },
    {
      name: 'a request that never reached Cloud',
      answer: () => Promise.reject(new TypeError('offline'))
    },
    {
      name: 'a status this build does not know',
      answer: () => Response.json({ status: 'refunded' })
    },
    {
      name: 'an answer that is not JSON',
      answer: () => new Response('<html>', { status: 200 })
    }
  ])('reads $name as no answer, not as a refusal', async ({ answer }) => {
    respondToFetch(OUTCOME_URL, answer)

    await expect(read()).resolves.toEqual({ kind: 'unknown' })
  })

  it('stops waiting for an answer that does not come in time', async () => {
    const reading = read({ fetchImpl: neverAnswering(), timeoutMs: 5_000 })

    await vi.advanceTimersByTimeAsync(5_000)

    await expect(reading).resolves.toEqual({ kind: 'unknown' })
  })

  it('stops waiting when its caller does', async () => {
    const caller = new AbortController()
    const reading = read({
      fetchImpl: neverAnswering(),
      signal: caller.signal
    })

    caller.abort()

    await expect(reading).resolves.toEqual({ kind: 'unknown' })
  })
})
