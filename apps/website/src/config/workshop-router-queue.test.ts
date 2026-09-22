import { assert, beforeEach, describe, expect, it, vi } from 'vitest'

import { workshopContract } from './workshop-contract-catalog'
import { WORKSHOP_ROUTER_BASE_URL } from './workshop-env'
import { WorkshopRouterError } from './workshop-router-errors'
import { runWorkshopRouter } from './workshop-router-queue'

const MODEL = 'bfl/flux-2-pro'
const REQUEST_ID = '6f1a1a6e-6a53-4a5f-9d3a-2b3b0a1f9c21'
const SUBMIT_URL = `${WORKSHOP_ROUTER_BASE_URL}/v2/models/${MODEL}/requests`
const RESULT_URL = `${SUBMIT_URL}/${REQUEST_ID}`

function options(signal = new AbortController().signal) {
  const contract = workshopContract(MODEL)
  assert.exists(contract)
  return {
    contract,
    body: { prompt: 'Private prompt' },
    token: 'test-token',
    idempotencyKey: 'logical-run',
    signal
  }
}

function admitted() {
  return Response.json(
    { request_id: REQUEST_ID, status: 'IN_QUEUE' },
    { status: 201, headers: { 'X-Comfy-Request-Id': 'submit-call' } }
  )
}

function pending(retryAfter = '1') {
  return Response.json(
    { request_id: REQUEST_ID, status: 'IN_PROGRESS' },
    { status: 202, headers: { 'Retry-After': retryAfter } }
  )
}

function result() {
  return Response.json({
    id: 'generation',
    status: 'Ready',
    result: { sample: 'https://media.example/result.png' }
  })
}

function refusal(status: number, errorType: string, retryAfter?: string) {
  return Response.json(
    { detail: 'refused', error_type: errorType },
    {
      status,
      headers: {
        'X-Comfy-Error-Type': errorType,
        ...(retryAfter === undefined ? {} : { 'Retry-After': retryAfter })
      }
    }
  )
}

function stubFetch(...responses: (Response | Error)[]) {
  const calls = vi.fn<typeof fetch>()
  for (const response of responses)
    if (response instanceof Error) calls.mockRejectedValueOnce(response)
    else calls.mockResolvedValueOnce(response)
  vi.stubGlobal('fetch', calls)
  return calls
}

async function settle<T>(run: Promise<T>): Promise<T> {
  const outcome = run.then(
    (value) => ({ value }),
    (error: unknown) => ({ error })
  )
  await vi.runAllTimersAsync()
  const settled = await outcome
  if ('error' in settled) throw settled.error
  return settled.value
}

async function withoutStaticAbortSignalHelpers<T>(
  action: () => Promise<T>
): Promise<T> {
  const nativeAny = Object.getOwnPropertyDescriptor(AbortSignal, 'any')
  const nativeTimeout = Object.getOwnPropertyDescriptor(AbortSignal, 'timeout')
  Object.defineProperty(AbortSignal, 'any', {
    configurable: true,
    value: undefined
  })
  Object.defineProperty(AbortSignal, 'timeout', {
    configurable: true,
    value: undefined
  })
  try {
    return await action()
  } finally {
    if (nativeAny) Object.defineProperty(AbortSignal, 'any', nativeAny)
    else Reflect.deleteProperty(AbortSignal, 'any')
    if (nativeTimeout)
      Object.defineProperty(AbortSignal, 'timeout', nativeTimeout)
    else Reflect.deleteProperty(AbortSignal, 'timeout')
  }
}

function requestedUrls(calls: ReturnType<typeof stubFetch>) {
  return calls.mock.calls.map(([url, init]) => `${init?.method} ${String(url)}`)
}

describe('queued Router delivery', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-09-19T12:00:00Z'))
  })

  it('submits once, polls until the run finishes, and reports the durable request id', async () => {
    const calls = stubFetch(admitted(), pending(), pending(), result())
    const onRequestId = vi.fn()
    const rendered = await settle(
      runWorkshopRouter({ ...options(), onRequestId })
    )
    expect(rendered.outputs[0].url).toBe('https://media.example/result.png')
    expect(rendered.requestId).toBe(REQUEST_ID)
    expect(onRequestId).toHaveBeenLastCalledWith(REQUEST_ID)
    expect(requestedUrls(calls)).toEqual([
      `POST ${SUBMIT_URL}`,
      `GET ${RESULT_URL}`,
      `GET ${RESULT_URL}`,
      `GET ${RESULT_URL}`
    ])
    const submit = calls.mock.calls[0][1]
    expect(new Headers(submit?.headers).get('Idempotency-Key')).toBe(
      'logical-run'
    )
    expect(submit?.body).toBe('{"prompt":"Private prompt"}')
  })

  it('runs when Safari lacks the static AbortSignal helpers', async () => {
    const calls = stubFetch(admitted(), result())

    const rendered = await withoutStaticAbortSignalHelpers(() =>
      settle(runWorkshopRouter(options()))
    )

    expect(rendered.outputs[0].url).toBe('https://media.example/result.png')
    expect(calls).toHaveBeenCalledTimes(2)
  })

  it('keeps collecting the same run when the connection drops mid-generation', async () => {
    const calls = stubFetch(
      admitted(),
      pending(),
      new TypeError('Failed to fetch'),
      new TypeError('Failed to fetch'),
      refusal(503, 'service_unavailable'),
      result()
    )
    const rendered = await settle(runWorkshopRouter(options()))
    expect(rendered.requestId).toBe(REQUEST_ID)
    expect(
      requestedUrls(calls).filter((request) => request.startsWith('POST'))
    ).toHaveLength(1)
  })

  it.for([
    ['numeric', '60'],
    ['HTTP-date', 'Sat, 19 Sep 2026 12:01:00 GMT']
  ])(
    'respects a %s Retry-After on an interrupted result read',
    async ([, retryAfter]) => {
      stubFetch(
        admitted(),
        refusal(503, 'service_unavailable', retryAfter),
        result()
      )
      const startedAt = Date.now()
      await settle(runWorkshopRouter(options()))
      expect(Date.now() - startedAt).toBe(60_000)
    }
  )

  it('backs off repeated result-read interruptions without a valid Retry-After', async () => {
    stubFetch(
      admitted(),
      refusal(503, 'service_unavailable'),
      refusal(503, 'service_unavailable', 'invalid'),
      result()
    )
    const startedAt = Date.now()
    await settle(runWorkshopRouter(options()))
    expect(Date.now() - startedAt).toBe(6_000)
  })

  it('backs off an interrupted result read with a past HTTP-date', async () => {
    stubFetch(
      admitted(),
      refusal(503, 'service_unavailable', 'Sat, 19 Sep 2026 11:59:00 GMT'),
      result()
    )
    const startedAt = Date.now()
    await settle(runWorkshopRouter(options()))
    expect(Date.now() - startedAt).toBe(2_000)
  })

  it('resubmits an interrupted submit with the identical key and body', async () => {
    const calls = stubFetch(
      new TypeError('Failed to fetch'),
      admitted(),
      result()
    )
    await settle(runWorkshopRouter(options()))
    const submits = calls.mock.calls.slice(0, 2)
    for (const [url, init] of submits) {
      expect(String(url)).toBe(SUBMIT_URL)
      expect(new Headers(init?.headers).get('Idempotency-Key')).toBe(
        'logical-run'
      )
      expect(init?.body).toBe('{"prompt":"Private prompt"}')
    }
  })

  it('reads the result again when its body is cut off, without resubmitting', async () => {
    const cutOff = new Response(
      new ReadableStream({
        start(controller) {
          controller.error(new TypeError('Connection lost'))
        }
      }),
      { headers: { 'Content-Type': 'application/json' } }
    )
    const calls = stubFetch(admitted(), cutOff, result())
    const rendered = await settle(runWorkshopRouter(options()))
    expect(rendered.outputs[0].url).toBe('https://media.example/result.png')
    expect(requestedUrls(calls)).toEqual([
      `POST ${SUBMIT_URL}`,
      `GET ${RESULT_URL}`,
      `GET ${RESULT_URL}`
    ])
  })

  it('gives up as a network failure that still names the run once the connection stays down', async () => {
    const calls = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(admitted())
      .mockRejectedValue(new TypeError('Failed to fetch'))
    vi.stubGlobal('fetch', calls)
    await expect(settle(runWorkshopRouter(options()))).rejects.toMatchObject({
      reason: 'network',
      requestId: REQUEST_ID,
      requestSettlement: 'pending'
    })
  })

  it('keeps the admitted run recoverable when credential refresh fails while collecting', async () => {
    stubFetch(admitted())
    const freshToken = vi
      .fn<() => Promise<string>>()
      .mockResolvedValueOnce('submit-token')
      .mockRejectedValueOnce(new WorkshopRouterError('unavailable'))
    await expect(
      settle(runWorkshopRouter({ ...options(), freshToken }))
    ).rejects.toMatchObject({
      reason: 'unavailable',
      requestId: REQUEST_ID,
      requestSettlement: 'pending'
    })
  })

  it('keeps the admitted run recoverable after repeated result-read refusals', async () => {
    const refusals = Array.from({ length: 21 }, () =>
      refusal(503, 'service_unavailable')
    )
    stubFetch(admitted(), ...refusals)
    await expect(settle(runWorkshopRouter(options()))).rejects.toMatchObject({
      reason: 'provider',
      requestId: REQUEST_ID,
      response: { status: 503, errorType: 'service_unavailable' },
      requestSettlement: 'pending'
    })
  })

  it.for([
    [402, 'insufficient_credits', 'noCredits'],
    [422, 'invalid_input', 'validation'],
    [400, 'content_policy_violation', 'policy']
  ] as const)(
    'reports a %i %s refusal at submit without polling',
    async ([status, errorType, reason]) => {
      const calls = stubFetch(refusal(status, errorType))
      await expect(settle(runWorkshopRouter(options()))).rejects.toMatchObject({
        reason,
        response: { status, errorType }
      })
      expect(calls).toHaveBeenCalledOnce()
    }
  )

  it('reports the stored failure of a finished run', async () => {
    stubFetch(admitted(), pending(), refusal(502, 'provider_error'))
    await expect(settle(runWorkshopRouter(options()))).rejects.toMatchObject({
      reason: 'provider',
      requestId: REQUEST_ID,
      response: { status: 502 },
      requestSettlement: 'terminal'
    })
  })

  it('falls back to the synchronous route when queued delivery is not enabled for the caller', async () => {
    const calls = stubFetch(refusal(403, 'not_enabled'), result())
    const tokens = ['queued-token', 'synchronous-token']
    const rendered = await settle(
      runWorkshopRouter({
        ...options(),
        token: 'initial-token',
        freshToken: async () => tokens.shift() ?? 'exhausted'
      })
    )
    expect(rendered.outputs[0].url).toBe('https://media.example/result.png')
    expect(requestedUrls(calls)).toEqual([
      `POST ${SUBMIT_URL}`,
      `POST ${WORKSHOP_ROUTER_BASE_URL}/v2/models/${MODEL}`
    ])
    expect(
      new Headers(calls.mock.calls[1][1]?.headers).get('Idempotency-Key')
    ).toBe('logical-run')
    expect(
      new Headers(calls.mock.calls[1][1]?.headers).get('Authorization')
    ).toBe('Bearer synchronous-token')
  })

  it('uses a fresh credential for every request of a long run', async () => {
    const calls = stubFetch(admitted(), pending(), result())
    const tokens = ['first', 'second', 'third']
    await settle(
      runWorkshopRouter({
        ...options(),
        freshToken: async () => tokens.shift() ?? 'exhausted'
      })
    )
    expect(
      calls.mock.calls.map(([, init]) =>
        new Headers(init?.headers).get('Authorization')
      )
    ).toEqual(['Bearer first', 'Bearer second', 'Bearer third'])
  })

  it('asks Router to cancel the admitted run with the latest credential', async () => {
    const controller = new AbortController()
    const calls = vi.fn<typeof fetch>(async (_, init) => {
      if (init?.method === 'POST') return admitted()
      if (init?.method === 'PUT') return Response.json({}, { status: 202 })
      controller.abort()
      throw controller.signal.reason
    })
    vi.stubGlobal('fetch', calls)
    const tokens = ['submit-token', 'poll-token']
    await expect(
      settle(
        runWorkshopRouter({
          ...options(controller.signal),
          freshToken: async () => tokens.shift() ?? 'exhausted'
        })
      )
    ).rejects.toMatchObject({ name: 'AbortError' })
    expect(requestedUrls(calls).at(-1)).toBe(`PUT ${RESULT_URL}/cancel`)
    expect(
      new Headers(calls.mock.calls.at(-1)?.[1]?.headers).get('Authorization')
    ).toBe('Bearer poll-token')
  })

  it.for([
    ['a path-shaped request id', '{"request_id":"../other"}'],
    ['a body that is not JSON', '<html>']
  ])('rejects a submit answered with %s', async ([, body]) => {
    const calls = stubFetch(new Response(body, { status: 201 }))
    await expect(settle(runWorkshopRouter(options()))).rejects.toMatchObject({
      reason: 'response'
    })
    expect(calls).toHaveBeenCalledOnce()
  })
})
