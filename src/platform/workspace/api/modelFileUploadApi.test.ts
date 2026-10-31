import { beforeEach, describe, expect, it, vi } from 'vitest'

import { api } from '@/scripts/api'

import { modelFileUploadApi } from './modelFileUploadApi'

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
  aborted = false
  upload: { onprogress: ((event: { loaded: number }) => void) | null } = {
    onprogress: null
  }
  onload: (() => void) | null = null
  onerror: (() => void) | null = null
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
  finish(status: number) {
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

function serverAnswers(...answers: Array<Response | 'never'>) {
  const calls: Array<{ route: string; method?: string; body: unknown }> = []
  vi.mocked(api.fetchApi).mockImplementation((route, options) => {
    calls.push({
      route,
      method: options?.method,
      body: JSON.parse(String(options?.body))
    })
    const answer =
      answers.shift() ?? json(500, { code: 'INTERNAL', message: 'x' })
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

  it('starts, puts the bytes straight to storage with the signed headers, then completes', async () => {
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
        body: { filename: file.name, size_bytes: file.size, tags }
      },
      {
        route: `/assets/uploads/${UPLOAD_ID}/complete`,
        method: 'POST',
        body: { filename: file.name, tags }
      }
    ])
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
