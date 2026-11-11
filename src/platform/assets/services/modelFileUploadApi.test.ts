import { assert, beforeEach, describe, expect, it, vi } from 'vitest'

import { api } from '@/scripts/api'

import { modelFileUploadApi } from '@/platform/assets/services/modelFileUploadApi'

vi.mock(import('@/scripts/api'))

const UPLOAD_ID = '2f4b8c1e-6a0d-4e7b-9c3a-1d5e8f7a9b20'
const TASK_ID = '8c2d4e6f-1a3b-4c5d-9e7f-0a1b2c3d4e5f'
const SIGNED_URL = 'https://storage.example.com/temp/model-uploads/x?sig=1'
const SIGNED_HEADERS = {
  'Content-Type': 'application/octet-stream',
  'x-goog-content-length-range': '0,12',
  'x-goog-if-generation-match': '0'
}

class StorageRequest {
  static sent: StorageRequest[] = []
  method = ''
  url = ''
  headers: Record<string, string> = {}
  body: unknown
  status = 0
  range: string | null = null
  aborted = false
  upload: { onprogress: ((event: { loaded: number }) => void) | null } = {
    onprogress: null
  }
  onload: (() => void) | null = null
  onerror: (() => void) | null = null
  ontimeout: (() => void) | null = null
  onabort: (() => void) | null = null
  onloadend: (() => void) | null = null

  open(method: string, url: string) {
    this.method = method
    this.url = url
  }
  setRequestHeader(name: string, value: string) {
    this.headers[name] = value
  }
  send(body: unknown) {
    this.body = body
    StorageRequest.sent.push(this)
  }
  abort() {
    this.aborted = true
    this.onabort?.()
    this.onloadend?.()
  }
  progress(loaded: number) {
    this.upload.onprogress?.({ loaded })
  }
  getResponseHeader(name: string) {
    return name === 'Range' ? this.range : null
  }
  finish(status: number, range: string | null = null) {
    this.range = range
    this.status = status
    this.onload?.()
    this.onloadend?.()
  }
  fail() {
    this.onerror?.()
    this.onloadend?.()
  }
}

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' }
  })
}

const started = {
  upload_id: UPLOAD_ID,
  upload_url: SIGNED_URL,
  method: 'PUT',
  headers: SIGNED_HEADERS,
  expires_at: '2026-10-29T15:30:00Z',
  max_size_bytes: 2147483648
}

function serverAnswers(...answers: Array<Response | Error | 'never'>) {
  const calls: Array<{ route: string; method?: string; body: unknown }> = []
  vi.mocked(api.fetchApi).mockImplementation((route, options) => {
    calls.push({
      route,
      method: options?.method,
      body: JSON.parse(String(options?.body))
    })
    const answer =
      answers.shift() ?? json(500, { code: 'INTERNAL', message: 'x' })
    if (answer instanceof Error) return Promise.reject(answer)
    if (answer !== 'never') return Promise.resolve(answer)
    return new Promise((_resolve, reject) => {
      options?.signal?.addEventListener('abort', () =>
        reject(new DOMException('Aborted', 'AbortError'))
      )
    })
  })
  return calls
}

async function storageRequest(nth = 1) {
  await vi.waitFor(() => expect(StorageRequest.sent).toHaveLength(nth))
  return StorageRequest.sent[nth - 1]
}

const file = new File(['twelve bytes'], 'my_style_v2.safetensors')
const tags = ['models', 'loras']

describe('modelFileUploadApi.uploadModelFile', () => {
  beforeEach(() => {
    StorageRequest.sent = []
    vi.stubGlobal('XMLHttpRequest', StorageRequest)
  })

  function upload(signal = new AbortController().signal) {
    const onProgress = vi.fn()
    const result = modelFileUploadApi.uploadModelFile(file, {
      tags,
      signal,
      onProgress
    })
    return { result, onProgress }
  }

  it('keeps one PUT with signed headers when the server omits upload_mode', async () => {
    const calls = serverAnswers(
      json(201, started),
      json(202, { task_id: TASK_ID, status: 'created' })
    )
    const { result, onProgress } = upload()

    const put = await storageRequest()
    expect(put.method).toBe('PUT')
    expect(put.url).toBe(SIGNED_URL)
    expect(put.headers).toEqual(SIGNED_HEADERS)
    expect(put.body).toBe(file)
    put.progress(5)
    put.finish(200)

    await expect(result).resolves.toEqual({ ok: true, taskId: TASK_ID })
    expect(onProgress).toHaveBeenCalledWith(5)
    expect(calls).toEqual([
      {
        route: '/assets/uploads',
        method: 'POST',
        body: {
          filename: file.name,
          size_bytes: file.size,
          resumable: true,
          tags,
          upload_analytics: { client: 'editor' }
        }
      },
      {
        route: `/assets/uploads/${UPLOAD_ID}/complete`,
        method: 'POST',
        body: {
          filename: file.name,
          tags,
          upload_analytics: { client: 'editor' }
        }
      }
    ])
  })

  it.for([12, 2147483648])(
    'uploads a %s-byte file with one PUT when resumable uploads are disabled',
    async (size) => {
      vi.spyOn(file, 'size', 'get').mockReturnValue(size)
      const headers = {
        ...SIGNED_HEADERS,
        'x-goog-content-length-range': `0,${size}`
      }
      const calls = serverAnswers(
        json(403, { code: 'FEATURE_DISABLED', message: 'not enabled' }),
        json(201, { ...started, headers }),
        json(202, { task_id: TASK_ID, status: 'created' })
      )
      const { result } = upload()

      const put = await storageRequest()
      expect(put.headers).toEqual(headers)
      expect(put.body).toBe(file)
      put.finish(200)

      await expect(result).resolves.toEqual({ ok: true, taskId: TASK_ID })
      expect(calls).toEqual([
        {
          route: '/assets/uploads',
          method: 'POST',
          body: {
            filename: file.name,
            size_bytes: size,
            resumable: true,
            tags,
            upload_analytics: { client: 'editor' }
          }
        },
        {
          route: '/assets/uploads',
          method: 'POST',
          body: {
            filename: file.name,
            size_bytes: size,
            resumable: false,
            tags,
            upload_analytics: { client: 'editor' }
          }
        },
        {
          route: `/assets/uploads/${UPLOAD_ID}/complete`,
          method: 'POST',
          body: {
            filename: file.name,
            tags,
            upload_analytics: { client: 'editor' }
          }
        }
      ])
    }
  )

  it("reports the server's size limit when a file over 2 GiB is refused resumable mode", async () => {
    const size = 2147483649
    vi.spyOn(file, 'size', 'get').mockReturnValue(size)
    const calls = serverAnswers(
      json(403, {
        code: 'FEATURE_DISABLED',
        message: 'Resumable model uploads are not enabled'
      }),
      json(400, {
        code: 'FILE_TOO_LARGE',
        message: 'Files can be up to 2 GB.'
      })
    )

    await expect(upload().result).resolves.toEqual({
      ok: false,
      reason: 'tooLarge',
      message: 'Files can be up to 2 GB.'
    })
    expect(calls).toEqual([
      {
        route: '/assets/uploads',
        method: 'POST',
        body: {
          filename: file.name,
          size_bytes: size,
          resumable: true,
          tags,
          upload_analytics: { client: 'editor' }
        }
      },
      {
        route: '/assets/uploads',
        method: 'POST',
        body: {
          filename: file.name,
          size_bytes: size,
          resumable: false,
          tags,
          upload_analytics: { client: 'editor' }
        }
      }
    ])
    expect(StorageRequest.sent).toHaveLength(0)
  })

  it.for([
    { code: 'FEATURE_DISABLED', expected: { ok: false, reason: 'failed' } },
    {
      code: 'PRIVATE_MODELS_DISABLED',
      expected: { ok: false, reason: 'privateModelsDisabled' }
    }
  ])(
    'stops when the single-PUT start also refuses $code',
    async ({ code, expected }) => {
      const calls = serverAnswers(
        json(403, { code: 'FEATURE_DISABLED', message: 'not enabled' }),
        json(403, { code, message: 'not enabled' })
      )

      await expect(upload().result).resolves.toMatchObject(expected)
      expect(calls).toHaveLength(2)
      expect(StorageRequest.sent).toHaveLength(0)
    }
  )

  it('cancels while waiting for the single-PUT start', async () => {
    serverAnswers(
      json(403, { code: 'FEATURE_DISABLED', message: 'not enabled' }),
      'never'
    )
    const controller = new AbortController()
    const { result } = upload(controller.signal)
    await vi.waitFor(() => expect(api.fetchApi).toHaveBeenCalledTimes(2))

    controller.abort()

    await expect(result).resolves.toEqual({ ok: false, reason: 'cancelled' })
    expect(StorageRequest.sent).toHaveLength(0)
  })

  it.for([
    {
      refusal: 'the file type',
      status: 400,
      body: { code: 'UNSUPPORTED_FILE_TYPE', message: 'not safetensors' },
      expected: { ok: false, reason: 'unsupportedFile' }
    },
    {
      refusal: 'the file size, with its limit message',
      status: 400,
      body: { code: 'FILE_TOO_LARGE', message: 'Files can be up to 2 GB.' },
      expected: {
        ok: false,
        reason: 'tooLarge',
        message: 'Files can be up to 2 GB.'
      }
    },
    {
      refusal: 'the model folder',
      status: 400,
      body: { code: 'UNSUPPORTED_MODEL_TYPE', message: 'not stored' },
      expected: { ok: false, reason: 'unsupportedType' }
    },
    {
      refusal: 'a plan without private models',
      status: 403,
      body: { code: 'PRIVATE_MODELS_DISABLED', message: 'from the server' },
      expected: { ok: false, reason: 'privateModelsDisabled' }
    },
    {
      refusal: 'a plan it could not read',
      status: 503,
      body: { code: 'PRIVATE_MODELS_UNAVAILABLE', message: 'from the server' },
      expected: { ok: false, reason: 'planUnavailable' }
    }
  ])(
    'sends no bytes when the start call refuses $refusal',
    async ({ status, body, expected }) => {
      serverAnswers(json(status, body))

      await expect(upload().result).resolves.toEqual(expected)
      expect(StorageRequest.sent).toHaveLength(0)
    }
  )

  it('says the model type is refused when the finish call refuses it', async () => {
    serverAnswers(
      json(201, started),
      json(400, { code: 'UNSUPPORTED_MODEL_TYPE', message: 'not stored' })
    )
    const { result } = upload()

    ;(await storageRequest()).finish(200)

    await expect(result).resolves.toEqual({
      ok: false,
      reason: 'unsupportedType'
    })
  })

  it.for([
    [403, 'PRIVATE_MODELS_DISABLED', 'privateModelsDisabled'],
    [503, 'PRIVATE_MODELS_UNAVAILABLE', 'planUnavailable'],
    [400, 'UNSUPPORTED_FILE_TYPE', 'unsupportedFile']
  ] as const)(
    'stops when the finish call answers %s %s',
    async ([status, code, reason]) => {
      serverAnswers(json(201, started), json(status, { code, message: 'x' }))
      const { result } = upload()

      ;(await storageRequest()).finish(200)

      await expect(result).resolves.toEqual({ ok: false, reason })
    }
  )

  it('finishes the same upload when storage already holds its object', async () => {
    const calls = serverAnswers(
      json(201, started),
      json(202, { task_id: TASK_ID, status: 'created' })
    )
    const { result } = upload()

    ;(await storageRequest()).finish(412)

    await expect(result).resolves.toEqual({ ok: true, taskId: TASK_ID })
    expect(StorageRequest.sent).toHaveLength(1)
    expect(calls.map((call) => call.route)).toEqual([
      '/assets/uploads',
      `/assets/uploads/${UPLOAD_ID}/complete`
    ])
  })

  it('fails without completing when storage refuses the bytes', async () => {
    const calls = serverAnswers(json(201, started))
    const { result } = upload()

    ;(await storageRequest()).finish(403)

    await expect(result).resolves.toMatchObject({ ok: false, reason: 'failed' })
    expect(calls).toHaveLength(1)
  })

  it('fails when the connection drops during the upload', async () => {
    serverAnswers(json(201, started))
    const { result } = upload()

    ;(await storageRequest()).fail()

    await expect(result).resolves.toMatchObject({ ok: false, reason: 'failed' })
  })

  it('stops the transfer and never completes when cancelled', async () => {
    const calls = serverAnswers(json(201, started))
    const controller = new AbortController()
    const { result } = upload(controller.signal)

    const put = await storageRequest()
    controller.abort()

    await expect(result).resolves.toEqual({ ok: false, reason: 'cancelled' })
    expect(put.aborted).toBe(true)
    expect(calls).toHaveLength(1)
  })

  it('stops waiting for the upload URL when cancelled', async () => {
    serverAnswers('never')
    const controller = new AbortController()
    const { result } = upload(controller.signal)
    await vi.waitFor(() => expect(api.fetchApi).toHaveBeenCalledOnce())

    controller.abort()

    await expect(result).resolves.toEqual({ ok: false, reason: 'cancelled' })
    expect(StorageRequest.sent).toHaveLength(0)
  })

  it('stops waiting for the finish answer when cancelled', async () => {
    serverAnswers(json(201, started), 'never')
    const controller = new AbortController()
    const { result } = upload(controller.signal)
    ;(await storageRequest()).finish(200)
    await vi.waitFor(() => expect(api.fetchApi).toHaveBeenCalledTimes(2))

    controller.abort()

    await expect(result).resolves.toEqual({ ok: false, reason: 'cancelled' })
  })

  it('fails when the finish answer is not a task', async () => {
    serverAnswers(json(201, started), json(202, { status: 'created' }))
    const { result } = upload()

    ;(await storageRequest()).finish(200)

    await expect(result).resolves.toMatchObject({ ok: false, reason: 'failed' })
  })
})

const resumable = {
  ...started,
  headers: {},
  upload_mode: 'resumable',
  chunk_size_bytes: 8,
  max_size_bytes: 26_843_545_600
}

describe('resumable model transfers', () => {
  beforeEach(() => {
    StorageRequest.sent = []
    vi.stubGlobal('XMLHttpRequest', StorageRequest)
    vi.useFakeTimers()
    return () => vi.useRealTimers()
  })

  function upload(signal = new AbortController().signal) {
    const onProgress = vi.fn()
    const onReconnecting = vi.fn()
    const result = modelFileUploadApi.uploadModelFile(file, {
      tags,
      signal,
      onProgress,
      onReconnecting
    })
    return { result, onProgress, onReconnecting }
  }

  function start() {
    return serverAnswers(
      json(201, resumable),
      json(202, { task_id: TASK_ID, status: 'created' })
    )
  }

  it('continues at the held byte after a dropped piece and stores the original file', async () => {
    const calls = start()
    const { result, onProgress, onReconnecting } = upload()
    const first = await storageRequest()
    expect(first.headers['Content-Range']).toBe('bytes 0-7/12')
    assert.instanceOf(first.body, Blob)
    const held = first.body.slice(0, 3)
    first.progress(6)
    first.fail()
    await vi.advanceTimersByTimeAsync(1000)

    const query = await storageRequest(2)
    expect(query.headers['Content-Range']).toBe('bytes */12')
    expect(query.body).toBeNull()
    expect(onReconnecting).toHaveBeenLastCalledWith(true)
    query.finish(308, 'bytes=0-2')

    const resumed = await storageRequest(3)
    expect(resumed.headers['Content-Range']).toBe('bytes 3-10/12')
    assert.instanceOf(resumed.body, Blob)
    expect(onReconnecting).toHaveBeenLastCalledWith(false)
    resumed.progress(4)
    expect(onProgress).toHaveBeenLastCalledWith(7)
    resumed.finish(308, 'bytes=0-10')

    const last = await storageRequest(4)
    expect(last.headers['Content-Range']).toBe('bytes 11-11/12')
    assert.instanceOf(last.body, Blob)
    last.finish(201)

    await expect(result).resolves.toEqual({ ok: true, taskId: TASK_ID })
    expect(await new Blob([held, resumed.body, last.body]).text()).toBe(
      'twelve bytes'
    )
    expect(onProgress).toHaveBeenLastCalledWith(12)
    expect(calls.at(-1)?.route).toBe(`/assets/uploads/${UPLOAD_ID}/complete`)
  })

  it('restarts at zero when a status query has no held range', async () => {
    start()
    const { result } = upload()
    ;(await storageRequest()).fail()
    await vi.advanceTimersByTimeAsync(1000)
    ;(await storageRequest(2)).finish(308)

    const retried = await storageRequest(3)
    expect(retried.headers['Content-Range']).toBe('bytes 0-7/12')
    retried.finish(308, 'bytes=0-7')
    const last = await storageRequest(4)
    expect(last.headers['Content-Range']).toBe('bytes 8-11/12')
    last.finish(200)
    await expect(result).resolves.toEqual({ ok: true, taskId: TASK_ID })
  })

  it.for([200, 201, 412])(
    'completes after a status query answers %s',
    async (status) => {
      const calls = start()
      const { result } = upload()
      ;(await storageRequest()).fail()
      await vi.advanceTimersByTimeAsync(1000)
      ;(await storageRequest(2)).finish(status)

      await expect(result).resolves.toEqual({ ok: true, taskId: TASK_ID })
      expect(calls.at(-1)?.route).toBe(`/assets/uploads/${UPLOAD_ID}/complete`)
    }
  )

  it.for([408, 429, 500, 503])(
    'queries storage before resending after %s',
    async (status) => {
      start()
      const { result } = upload()
      ;(await storageRequest()).finish(status)
      await vi.advanceTimersByTimeAsync(1000)
      const query = await storageRequest(2)
      expect(query.headers['Content-Range']).toBe('bytes */12')
      query.finish(412)
      await expect(result).resolves.toEqual({ ok: true, taskId: TASK_ID })
    }
  )

  it('retries a stalled status query and resumes from the held bytes', async () => {
    const calls = start()
    const { result } = upload()
    ;(await storageRequest()).fail()
    await vi.advanceTimersByTimeAsync(1000)
    const stalled = await storageRequest(2)

    await vi.advanceTimersByTimeAsync(60_000)

    expect(stalled.aborted).toBe(true)
    const query = await storageRequest(3)
    expect(query.headers['Content-Range']).toBe('bytes */12')
    query.finish(308, 'bytes=0-2')
    const resumed = await storageRequest(4)
    expect(resumed.headers['Content-Range']).toBe('bytes 3-10/12')
    resumed.finish(308, 'bytes=0-10')
    ;(await storageRequest(5)).finish(200)
    await expect(result).resolves.toEqual({ ok: true, taskId: TASK_ID })
    expect(calls).toHaveLength(2)
  })

  it('queries held bytes after a piece stalls without a network error', async () => {
    start()
    const { result } = upload()
    const stalled = await storageRequest()

    await vi.advanceTimersByTimeAsync(60_000)

    expect(stalled.aborted).toBe(true)
    const query = await storageRequest(2)
    expect(query.headers['Content-Range']).toBe('bytes */12')
    query.finish(412)
    await expect(result).resolves.toEqual({ ok: true, taskId: TASK_ID })
  })

  it('keeps a slow piece alive while its upload makes progress', async () => {
    start()
    const { result } = upload()
    const piece = await storageRequest()

    await vi.advanceTimersByTimeAsync(20_000)
    piece.progress(1)
    await vi.advanceTimersByTimeAsync(20_000)
    piece.progress(2)
    await vi.advanceTimersByTimeAsync(20_000)
    piece.progress(3)
    await vi.advanceTimersByTimeAsync(20_000)

    expect(piece.aborted).toBe(false)
    expect(StorageRequest.sent).toHaveLength(1)
    piece.finish(308, 'bytes=0-7')
    ;(await storageRequest(2)).finish(200)
    await expect(result).resolves.toEqual({ ok: true, taskId: TASK_ID })
  })

  it('resumes after a partial piece acknowledgment without duplicating bytes', async () => {
    start()
    const { result } = upload()
    const first = await storageRequest()
    assert.instanceOf(first.body, Blob)
    const held = first.body.slice(0, 3)
    first.finish(308, 'bytes=0-2')

    const resumed = await storageRequest(2)
    expect(resumed.headers['Content-Range']).toBe('bytes 3-10/12')
    assert.instanceOf(resumed.body, Blob)
    resumed.finish(308, 'bytes=0-10')
    const last = await storageRequest(3)
    expect(last.headers['Content-Range']).toBe('bytes 11-11/12')
    assert.instanceOf(last.body, Blob)
    last.finish(200)

    await expect(result).resolves.toEqual({ ok: true, taskId: TASK_ID })
    expect(await new Blob([held, resumed.body, last.body]).text()).toBe(
      'twelve bytes'
    )
  })

  it('keeps querying with capped backoff while storage is unavailable', async () => {
    start()
    const { result } = upload()
    ;(await storageRequest()).fail()
    async function retry(nth: number, delay: number) {
      await vi.advanceTimersByTimeAsync(delay - 1)
      expect(StorageRequest.sent).toHaveLength(nth - 1)
      await vi.advanceTimersByTimeAsync(1)
      const query = await storageRequest(nth)
      expect(query.headers['Content-Range']).toBe('bytes */12')
      query.finish(503)
    }
    await retry(2, 1000)
    await retry(3, 2000)
    await retry(4, 4000)
    await retry(5, 8000)
    await retry(6, 16_000)
    await retry(7, 32_000)
    await retry(8, 60_000)
    await vi.advanceTimersByTimeAsync(60_000)
    ;(await storageRequest(9)).finish(200)
    await expect(result).resolves.toEqual({ ok: true, taskId: TASK_ID })
  })

  it.for([404, 410])(
    'offers a fresh session after storage answers %s',
    async (status) => {
      const calls = start()
      const { result } = upload()
      ;(await storageRequest()).finish(status)
      await expect(result).resolves.toEqual({
        ok: false,
        reason: 'sessionExpired'
      })
      expect(calls).toHaveLength(1)
    }
  )

  it.for(['bytes=0-12', 'bytes=3-7', 'unreadable'])(
    'stops on an invalid storage range %s',
    async (range) => {
      const calls = start()
      const { result } = upload()
      ;(await storageRequest()).finish(308, range)
      await expect(result).resolves.toMatchObject({
        ok: false,
        reason: 'failed'
      })
      expect(calls).toHaveLength(1)
    }
  )

  it('stops an active piece when canceled', async () => {
    start()
    const controller = new AbortController()
    const { result } = upload(controller.signal)
    const piece = await storageRequest()
    controller.abort()
    await expect(result).resolves.toEqual({ ok: false, reason: 'cancelled' })
    expect(piece.aborted).toBe(true)
    expect(StorageRequest.sent).toHaveLength(1)
  })

  it('stops a retry wait without another request when canceled', async () => {
    start()
    const controller = new AbortController()
    const { result } = upload(controller.signal)
    ;(await storageRequest()).fail()
    await vi.advanceTimersByTimeAsync(0)
    controller.abort()
    await expect(result).resolves.toEqual({ ok: false, reason: 'cancelled' })
    await vi.advanceTimersByTimeAsync(120_000)
    expect(StorageRequest.sent).toHaveLength(1)
  })

  it('stops an in-flight status query when canceled', async () => {
    start()
    const controller = new AbortController()
    const { result } = upload(controller.signal)
    ;(await storageRequest()).fail()
    await vi.advanceTimersByTimeAsync(1000)
    const query = await storageRequest(2)
    controller.abort()
    await expect(result).resolves.toEqual({ ok: false, reason: 'cancelled' })
    expect(query.aborted).toBe(true)
    expect(StorageRequest.sent).toHaveLength(2)
  })
})

const EVENTS_ROUTE = `/assets/uploads/${UPLOAD_ID}/events`

function noContent() {
  return new Response(null, { status: 204 })
}

describe('model upload reports', () => {
  beforeEach(() => {
    StorageRequest.sent = []
    vi.stubGlobal('XMLHttpRequest', StorageRequest)
    vi.useFakeTimers()
    return () => vi.useRealTimers()
  })

  function upload(signal = new AbortController().signal) {
    return modelFileUploadApi.uploadModelFile(file, {
      tags,
      signal,
      onProgress: vi.fn()
    })
  }

  function finishing(start: object) {
    return serverAnswers(
      json(201, { ...start, upload_analytics_version: 1 }),
      json(202, { task_id: TASK_ID, status: 'created' })
    )
  }

  function eventsCalls(calls: ReturnType<typeof serverAnswers>) {
    return calls.filter((call) => call.route === EVENTS_ROUTE)
  }

  function lastRequest() {
    const call = vi.mocked(api.fetchApi).mock.lastCall
    return { route: call?.[0], signal: call?.[1]?.signal }
  }

  it('names the editor at start and reports a transfer that never needed recovery', async () => {
    const calls = finishing(resumable)
    const result = upload()
    ;(await storageRequest()).finish(308, 'bytes=0-7')
    ;(await storageRequest(2)).finish(200)

    await expect(result).resolves.toEqual({ ok: true, taskId: TASK_ID })
    expect(calls[0].body).toMatchObject({
      upload_analytics: { client: 'editor' }
    })
    expect(calls.at(-1)).toEqual({
      route: `/assets/uploads/${UPLOAD_ID}/complete`,
      method: 'POST',
      body: {
        filename: file.name,
        tags,
        upload_analytics: { client: 'editor', resumed: false }
      }
    })
    expect(calls).toHaveLength(2)
  })

  it('reports a resume after a status query finds held bytes', async () => {
    const calls = finishing(resumable)
    const result = upload()
    ;(await storageRequest()).fail()
    await vi.advanceTimersByTimeAsync(1000)
    ;(await storageRequest(2)).finish(308, 'bytes=0-2')
    ;(await storageRequest(3)).finish(308, 'bytes=0-10')
    ;(await storageRequest(4)).finish(201)

    await expect(result).resolves.toEqual({ ok: true, taskId: TASK_ID })
    expect(calls.at(-1)?.body).toMatchObject({
      upload_analytics: { client: 'editor', resumed: true }
    })
  })

  it.for([
    {
      recovery: 'a status query with no held range restarts at zero',
      answers: ['fail', 'wait', [308, null], [308, 'bytes=0-7'], [200, null]]
    },
    {
      recovery: 'storage holds part of a piece without a status query',
      answers: [
        [308, 'bytes=0-2'],
        [308, 'bytes=0-10'],
        [200, null]
      ]
    },
    {
      recovery: 'a status query finds the whole file',
      answers: ['fail', 'wait', [200, null]]
    }
  ] as const)(
    'does not call it a resume when $recovery',
    async ({ answers }) => {
      const calls = finishing(resumable)
      const result = upload()
      let nth = 0
      for (const answer of answers) {
        if (answer === 'wait') {
          await vi.advanceTimersByTimeAsync(1000)
          continue
        }
        const request = await storageRequest(++nth)
        if (answer === 'fail') request.fail()
        else request.finish(answer[0], answer[1])
      }

      await expect(result).resolves.toEqual({ ok: true, taskId: TASK_ID })
      expect(calls.at(-1)?.body).toMatchObject({
        upload_analytics: { client: 'editor', resumed: false }
      })
    }
  )

  it('leaves resume unknown for a single PUT', async () => {
    const calls = finishing(started)
    const result = upload()
    ;(await storageRequest()).finish(200)

    await expect(result).resolves.toEqual({ ok: true, taskId: TASK_ID })
    expect(calls.at(-1)?.body).toEqual({
      filename: file.name,
      tags,
      upload_analytics: { client: 'editor' }
    })
  })

  it.for([
    {
      failure: 'storage expires the resumable session',
      start: resumable,
      storage: [404, null],
      expected: { ok: false, reason: 'sessionExpired' },
      report: { reason: 'session_expired', resumed: false }
    },
    {
      failure: 'storage answers an unreadable range',
      start: resumable,
      storage: [308, 'bytes=3-7'],
      expected: { ok: false, reason: 'failed' },
      report: { reason: 'unknown', resumed: false }
    },
    {
      failure: 'storage refuses a single PUT',
      start: started,
      storage: [403, null],
      expected: { ok: false, reason: 'failed' },
      report: { reason: 'http' }
    },
    {
      failure: 'the connection drops during a single PUT',
      start: started,
      storage: 'fail',
      expected: { ok: false, reason: 'failed' },
      report: { reason: 'network' }
    }
  ] as const)(
    'reports one failure when $failure',
    async ({ start, storage, expected, report }) => {
      const calls = serverAnswers(
        json(201, { ...start, upload_analytics_version: 1 }),
        noContent()
      )
      const result = upload()
      const request = await storageRequest()
      if (storage === 'fail') request.fail()
      else request.finish(storage[0], storage[1])

      await expect(result).resolves.toMatchObject(expected)
      expect(calls).toHaveLength(2)
      expect(calls[1]).toEqual({
        route: EVENTS_ROUTE,
        method: 'POST',
        body: {
          client: 'editor',
          size_bytes: file.size,
          model_folder: 'loras',
          ...report
        }
      })
    }
  )

  it('carries an observed resume into a later failure report', async () => {
    const calls = serverAnswers(
      json(201, { ...resumable, upload_analytics_version: 1 }),
      noContent()
    )
    const result = upload()
    ;(await storageRequest()).fail()
    await vi.advanceTimersByTimeAsync(1000)
    ;(await storageRequest(2)).finish(308, 'bytes=0-2')
    ;(await storageRequest(3)).finish(403)

    await expect(result).resolves.toMatchObject({ ok: false, reason: 'failed' })
    expect(eventsCalls(calls)).toEqual([
      expect.objectContaining({
        body: expect.objectContaining({ reason: 'http', resumed: true })
      })
    ])
  })

  it('reports a cancel on its own request without changing the result', async () => {
    const calls = serverAnswers(
      json(201, { ...resumable, upload_analytics_version: 1 }),
      noContent()
    )
    const controller = new AbortController()
    const result = upload(controller.signal)
    await storageRequest()
    controller.abort()

    await expect(result).resolves.toEqual({ ok: false, reason: 'cancelled' })
    expect(eventsCalls(calls)).toEqual([
      {
        route: EVENTS_ROUTE,
        method: 'POST',
        body: {
          client: 'editor',
          size_bytes: file.size,
          model_folder: 'loras',
          reason: 'canceled',
          resumed: false
        }
      }
    ])
    const report = lastRequest()
    expect(report.route).toBe(EVENTS_ROUTE)
    expect(report.signal?.aborted).toBe(false)
  })

  it('never reports a stop when start does not advertise reports', async () => {
    const calls = serverAnswers(json(201, resumable), json(201, resumable))
    const failed = upload()
    ;(await storageRequest()).finish(404)
    await expect(failed).resolves.toEqual({
      ok: false,
      reason: 'sessionExpired'
    })

    const controller = new AbortController()
    const cancelled = upload(controller.signal)
    await storageRequest(2)
    controller.abort()
    await expect(cancelled).resolves.toEqual({ ok: false, reason: 'cancelled' })

    expect(calls.map((call) => call.route)).toEqual([
      '/assets/uploads',
      '/assets/uploads'
    ])
  })

  it('returns the failure at once while the report hangs, then gives the report up', async () => {
    serverAnswers(
      json(201, { ...resumable, upload_analytics_version: 1 }),
      'never'
    )
    const result = upload()
    ;(await storageRequest()).finish(404)

    await expect(result).resolves.toEqual({
      ok: false,
      reason: 'sessionExpired'
    })
    const report = lastRequest()
    expect(report.route).toBe(EVENTS_ROUTE)
    expect(report.signal?.aborted).toBe(false)
    await vi.advanceTimersByTimeAsync(4999)
    expect(report.signal?.aborted).toBe(false)
    await vi.advanceTimersByTimeAsync(1)
    expect(report.signal?.aborted).toBe(true)
  })

  it('returns the original failure when the report is refused', async () => {
    const calls = serverAnswers(
      json(201, { ...resumable, upload_analytics_version: 1 }),
      new TypeError('Failed to fetch')
    )
    const result = upload()
    ;(await storageRequest()).finish(404)

    await expect(result).resolves.toEqual({
      ok: false,
      reason: 'sessionExpired'
    })
    expect(eventsCalls(calls)).toHaveLength(1)
  })
})
