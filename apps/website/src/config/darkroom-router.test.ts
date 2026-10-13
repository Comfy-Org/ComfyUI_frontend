import { fetchRequests } from '@comfyorg/test-utils/fetch'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import {
  cancelDarkroomImage,
  collectDarkroomImage,
  DarkroomRouterError,
  readDarkroomConcurrency,
  submitDarkroomImage
} from './darkroom-router'
import { WORKSHOP_ROUTER_BASE_URL } from './workshop-env'

const MODEL = 'vertexai/gemini-3.1-flash-lite-image'
const REQUEST_ID = '18655193-3f73-4abf-b49c-1c6a058355bc'
const REQUESTS = `${WORKSHOP_ROUTER_BASE_URL}/v2/models/${MODEL}/requests`
const token = () => Promise.resolve('test-token')
const signal = () => new AbortController().signal

const queued = (position: number) =>
  Response.json(
    { request_id: REQUEST_ID, status: 'IN_QUEUE', queue_position: position },
    { status: 202 }
  )
const running = () =>
  Response.json(
    { request_id: REQUEST_ID, status: 'IN_PROGRESS' },
    { status: 202 }
  )
const finished = () =>
  Response.json(
    {
      candidates: [
        {
          content: {
            parts: [{ inlineData: { mimeType: 'image/png', data: 'AAAA' } }]
          },
          finishReason: 'STOP'
        }
      ],
      usageMetadata: { totalTokenCount: 1212 }
    },
    { headers: { 'X-Comfy-Router-Fallback-Provider': 'google' } }
  )
const refused = (status: number, errorType: string) =>
  Response.json(
    { detail: 'no', error_type: errorType },
    { status, headers: { 'X-Comfy-Error-Type': errorType } }
  )

async function failureOf(run: Promise<unknown>) {
  const error = await run.catch((caught: unknown) => caught)
  expect(error).toBeInstanceOf(DarkroomRouterError)
  return error instanceof DarkroomRouterError ? error.failure : undefined
}

beforeEach(() => {
  vi.useFakeTimers()
})

describe('submitDarkroomImage', () => {
  it('queues the image as the signed-in account', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      Response.json(
        { request_id: REQUEST_ID, status: 'IN_QUEUE', queue_position: 3 },
        { status: 201 }
      )
    )

    const submission = await submitDarkroomImage({
      model: MODEL,
      body: { contents: [] },
      idempotencyKey: 'key-1',
      token,
      signal: signal()
    })

    expect(submission).toEqual({
      requestId: REQUEST_ID,
      progress: { phase: 'queued', ahead: 3 }
    })
    const [request] = fetchRequests()
    expect(request.url).toBe(REQUESTS)
    expect(request.method).toBe('POST')
    expect(request.headers.get('Authorization')).toBe('Bearer test-token')
    expect(request.headers.get('Idempotency-Key')).toBe('key-1')
    expect(request.body).toBe('{"contents":[]}')
  })

  it('reports an empty balance before anything is queued', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(refused(402, 'insufficient_credits'))

    expect(
      await failureOf(
        submitDarkroomImage({
          model: MODEL,
          body: {},
          idempotencyKey: 'key-1',
          token,
          signal: signal()
        })
      )
    ).toBe('noCredits')
  })

  it('never calls Router for a model Darkroom does not offer', async () => {
    expect(
      await failureOf(
        submitDarkroomImage({
          model: 'vertexai/../../customers',
          body: {},
          idempotencyKey: 'key-1',
          token,
          signal: signal()
        })
      )
    ).toBe('unavailable')
    expect(fetch).not.toHaveBeenCalled()
  })

  it('reports a dropped connection as a network failure', async () => {
    vi.mocked(fetch).mockRejectedValueOnce(new TypeError('Failed to fetch'))

    expect(
      await failureOf(
        submitDarkroomImage({
          model: MODEL,
          body: {},
          idempotencyKey: 'key-1',
          token,
          signal: signal()
        })
      )
    ).toBe('network')
  })
})

describe('collectDarkroomImage', () => {
  it('follows an image from the line to the finished result', async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce(queued(2))
      .mockResolvedValueOnce(running())
      .mockResolvedValueOnce(finished())
    const progress: unknown[] = []

    const collecting = collectDarkroomImage({
      model: MODEL,
      requestId: REQUEST_ID,
      token,
      signal: signal(),
      onProgress: (step) => progress.push(step)
    })
    await vi.runAllTimersAsync()
    const result = await collecting

    expect(progress).toEqual([
      { phase: 'queued', ahead: 2 },
      { phase: 'running' }
    ])
    expect(result.response.images).toEqual([
      { mime: 'image/png', data: 'AAAA' }
    ])
    expect(result.response.totalTokens).toBe(1212)
    expect(result.fallbackProvider).toBe('google')
    expect(fetchRequests().map((request) => request.url)).toEqual(
      Array(3).fill(`${REQUESTS}/${REQUEST_ID}`)
    )
  })

  it('waits out a dropped connection, since the request keeps running', async () => {
    vi.mocked(fetch)
      .mockRejectedValueOnce(new TypeError('Failed to fetch'))
      .mockResolvedValueOnce(new Response(null, { status: 503 }))
      .mockResolvedValueOnce(finished())

    const collecting = collectDarkroomImage({
      model: MODEL,
      requestId: REQUEST_ID,
      token,
      signal: signal()
    })
    await vi.runAllTimersAsync()

    expect((await collecting).response.images).toHaveLength(1)
  })

  it.for([
    [refused(400, 'content_policy_violation'), 'blocked'],
    [refused(200 + 299, 'cancelled'), 'stopped'],
    [refused(504, 'provider_timeout'), 'timeout'],
    [new Response(null, { status: 404 }), 'lost']
  ] as const)('ends on a refusal', async ([response, failure]) => {
    vi.mocked(fetch).mockResolvedValueOnce(response)

    expect(
      await failureOf(
        collectDarkroomImage({
          model: MODEL,
          requestId: REQUEST_ID,
          token,
          signal: signal()
        })
      )
    ).toBe(failure)
  })

  it('stops polling once the reader cancels', async () => {
    vi.mocked(fetch).mockResolvedValue(queued(1))
    const controller = new AbortController()

    const collecting = collectDarkroomImage({
      model: MODEL,
      requestId: REQUEST_ID,
      token,
      signal: controller.signal
    }).catch((error: unknown) => error)
    await vi.advanceTimersByTimeAsync(100)
    controller.abort()
    await vi.runAllTimersAsync()

    expect(await collecting).toBeInstanceOf(DOMException)
    expect(fetch).toHaveBeenCalledTimes(1)
  })

  it('refuses a request id that is not one', async () => {
    expect(
      await failureOf(
        collectDarkroomImage({
          model: MODEL,
          requestId: '../cancel',
          token,
          signal: signal()
        })
      )
    ).toBe('lost')
    expect(fetch).not.toHaveBeenCalled()
  })
})

describe('cancelDarkroomImage', () => {
  it('asks Router to stop the request', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(Response.json({}))

    await cancelDarkroomImage({ model: MODEL, requestId: REQUEST_ID, token })

    const [request] = fetchRequests()
    expect(request.url).toBe(`${REQUESTS}/${REQUEST_ID}/cancel`)
    expect(request.method).toBe('PUT')
  })
})

describe('readDarkroomConcurrency', () => {
  it('reads how many calls the account may have in flight', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      Response.json({ limit: 1, reason: 'never_paid' })
    )

    expect(await readDarkroomConcurrency(token, signal())).toBe(1)
    expect(fetchRequests()[0].url).toBe(
      `${WORKSHOP_ROUTER_BASE_URL}/customers/me/partner-node-concurrency`
    )
  })

  it.for([
    new Response(null, { status: 500 }),
    Response.json({ limit: 'many' }),
    Response.json({})
  ])('leaves the limit unknown when the read fails', async (response) => {
    vi.mocked(fetch).mockResolvedValueOnce(response)
    expect(await readDarkroomConcurrency(token, signal())).toBeUndefined()
  })
})
