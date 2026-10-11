import type {
  InputUploadResponse,
  UploadGrantResponse
} from '@comfyorg/ingest-types'
import { assert, describe, expect, it, vi } from 'vitest'

import { WORKSHOP_CLOUD_BASE_URL } from './workshop-env'
import { createWorkflowApi } from './workshop-workflow-api'
import { workflowCatalog } from './workshop-workflow-catalog'
import { WORKFLOW_FILE_BYTES } from './workshop-workflow-response'
import { createWorkflowUploader } from './workshop-workflow-upload'

const grant: UploadGrantResponse = {
  upload_path: '/api/uploads/first-grant',
  expires_in: 900
}
const result: InputUploadResponse = {
  name: 'input-hash',
  subfolder: '',
  type: 'input'
}
const bytes = new Uint8Array([1, 3, 5, 7])

function fixture(type = 'image/png') {
  const entry = workflowCatalog.find(
    ({ id }) => id === 'workflows/remove-background'
  )
  assert(entry)
  const definition = { ...structuredClone(entry), inputs: {} }
  const file = new File([bytes], 'private-file', { type })
  const fetch = vi
    .fn<typeof globalThis.fetch>()
    .mockResolvedValueOnce(Response.json(grant))
    .mockResolvedValueOnce(Response.json(result))
  const api = createWorkflowApi({ definition, fetch, token: 'caller-only' })
  return { file, fetch, definition, upload: createWorkflowUploader(api, fetch) }
}

describe('Workflow input upload grants', () => {
  it.for(['image/png', 'video/mp4', 'audio/wav'])(
    'uploads exact %s bytes without credentials and returns a loader reference',
    async (type) => {
      const f = fixture(type)

      expect(await f.upload(f.file, new AbortController().signal)).toBe(
        'input-hash'
      )
      expect(
        f.fetch.mock.calls.map(([url, init]) => [String(url), init?.method])
      ).toEqual([
        [`${WORKSHOP_CLOUD_BASE_URL}/api/inputs/upload-url`, 'POST'],
        [`${WORKSHOP_CLOUD_BASE_URL}/api/uploads/first-grant`, 'PUT']
      ])
      const [, mint] = f.fetch.mock.calls[0]
      expect(JSON.parse(String(mint?.body))).toEqual({ content_type: type })
      expect(new Headers(mint?.headers).get('Authorization')).toBe(
        'Bearer caller-only'
      )
      const [, put] = f.fetch.mock.calls[1]
      expect(put).toMatchObject({ credentials: 'omit', redirect: 'error' })
      const body = put?.body
      assert(body instanceof File)
      expect(new Uint8Array(await body.arrayBuffer())).toEqual(bytes)
      expect(
        Object.fromEntries(
          Array.from(new Headers(put?.headers), ([name, value]) => [
            name.toLowerCase(),
            value
          ])
        )
      ).toEqual({ 'content-type': type })
    }
  )

  it('downloads a URL without caller credentials before uploading its bytes', async () => {
    const f = fixture()
    const source = 'https://media.example/source.png'
    f.fetch
      .mockReset()
      .mockResolvedValueOnce(
        new Response(bytes, {
          headers: { 'Content-Type': 'image/png; charset=binary' }
        })
      )
      .mockResolvedValueOnce(Response.json(grant))
      .mockResolvedValueOnce(Response.json(result))

    expect(await f.upload(source, new AbortController().signal)).toBe(
      'input-hash'
    )
    const [url, get] = f.fetch.mock.calls[0]
    expect(url).toBe(source)
    expect(get).toMatchObject({
      credentials: 'omit',
      redirect: 'error',
      cache: 'no-store',
      referrerPolicy: 'no-referrer'
    })
    expect(new Headers(get?.headers).has('Authorization')).toBe(false)
    expect(new Headers(get?.headers).has('X-API-Key')).toBe(false)
    expect(JSON.parse(String(f.fetch.mock.calls[1][1]?.body))).toEqual({
      content_type: 'image/png'
    })
    const body = f.fetch.mock.calls[2][1]?.body
    assert(body instanceof File)
    expect(new Uint8Array(await body.arrayBuffer())).toEqual(bytes)
    expect(body.type).toBe('image/png')
    expect(
      new Headers(f.fetch.mock.calls[2][1]?.headers).has('Authorization')
    ).toBe(false)
  })

  it.for([
    'http://media.example/source.png',
    'data:image/png;base64,private',
    'blob:https://comfy.org/private',
    'https://user:secret@media.example/source.png',
    'https://media.example/source.png#private'
  ])('rejects unsafe source URL %s before fetching it', async (source) => {
    const f = fixture()

    await expect(
      f.upload(source, new AbortController().signal)
    ).rejects.toMatchObject({ code: 'invalid_input' })
    expect(f.fetch).not.toHaveBeenCalled()
  })

  it.for([
    {
      name: 'an off-origin grant',
      response: {
        ...grant,
        upload_path: 'https://attacker.example/api/uploads/secret'
      }
    },
    {
      name: 'a protocol-relative grant',
      response: {
        ...grant,
        upload_path: '//attacker.example/api/uploads/secret'
      }
    },
    {
      name: 'a grant with query parameters',
      response: { ...grant, upload_path: '/api/uploads/secret?token=private' }
    },
    {
      name: 'a grant with a parent segment',
      response: { ...grant, upload_path: '/api/uploads/../secret' }
    },
    { name: 'an expired grant', response: { ...grant, expires_in: 0 } },
    {
      name: 'an incomplete grant',
      response: { upload_path: grant.upload_path }
    }
  ])('rejects $name before sending file bytes', async ({ response }) => {
    const f = fixture()
    f.fetch.mockReset().mockResolvedValueOnce(Response.json(response))

    await expect(
      f.upload(f.file, new AbortController().signal)
    ).rejects.toMatchObject({ code: 'response' })
    expect(f.fetch).toHaveBeenCalledOnce()
  })

  it('does not upload when grant creation fails', async () => {
    const f = fixture()
    f.fetch
      .mockReset()
      .mockResolvedValueOnce(
        Response.json({ private_detail: 'secret' }, { status: 503 })
      )

    await expect(
      f.upload(f.file, new AbortController().signal)
    ).rejects.toMatchObject({ status: 503 })
    expect(f.fetch).toHaveBeenCalledOnce()
  })

  it.for([
    {
      name: 'a rejected PUT',
      fail: () => Promise.resolve(new Response(null, { status: 503 }))
    },
    {
      name: 'a lost PUT response',
      fail: () => Promise.reject(new TypeError('private transport detail'))
    }
  ])('mints a new grant when retrying after $name', async ({ fail }) => {
    const f = fixture()
    f.fetch
      .mockReset()
      .mockResolvedValueOnce(Response.json(grant))
      .mockImplementationOnce(fail)
      .mockResolvedValueOnce(
        Response.json({ ...grant, upload_path: '/api/uploads/retry-grant' })
      )
      .mockResolvedValueOnce(Response.json(result))
    const signal = new AbortController().signal

    await expect(f.upload(f.file, signal)).rejects.toMatchObject({
      code: 'media_unavailable'
    })
    expect(await f.upload(f.file, signal)).toBe('input-hash')
    expect(
      f.fetch.mock.calls.map(([url, init]) => [String(url), init?.method])
    ).toEqual([
      [`${WORKSHOP_CLOUD_BASE_URL}/api/inputs/upload-url`, 'POST'],
      [`${WORKSHOP_CLOUD_BASE_URL}/api/uploads/first-grant`, 'PUT'],
      [`${WORKSHOP_CLOUD_BASE_URL}/api/inputs/upload-url`, 'POST'],
      [`${WORKSHOP_CLOUD_BASE_URL}/api/uploads/retry-grant`, 'PUT']
    ])
  })

  it('discards a PUT response after caller cancellation', async () => {
    const f = fixture()
    const writing = Promise.withResolvers<void>()
    const written = Promise.withResolvers<Response>()
    f.fetch
      .mockReset()
      .mockResolvedValueOnce(Response.json(grant))
      .mockImplementationOnce(() => {
        writing.resolve()
        return written.promise
      })
    const controller = new AbortController()
    const upload = f.upload(f.file, controller.signal)

    await writing.promise
    controller.abort()
    written.resolve(Response.json(result))

    await expect(upload).rejects.toBe(controller.signal.reason)
    expect(f.fetch).toHaveBeenCalledTimes(2)
  })

  it('uses each caller credential when uploading the same file through another client', async () => {
    const f = fixture()
    const signal = new AbortController().signal
    await f.upload(f.file, signal)
    f.fetch
      .mockResolvedValueOnce(Response.json(grant))
      .mockResolvedValueOnce(Response.json(result))
    const another = createWorkflowUploader(
      createWorkflowApi({
        definition: f.definition,
        fetch: f.fetch,
        token: 'another-caller'
      }),
      f.fetch
    )

    expect(await another(f.file, signal)).toBe('input-hash')
    expect(
      new Headers(f.fetch.mock.calls[2][1]?.headers).get('Authorization')
    ).toBe('Bearer another-caller')
  })

  it.for([
    { name: 'an empty file', size: 0, type: 'image/png' },
    {
      name: 'an oversized file',
      size: WORKFLOW_FILE_BYTES + 1,
      type: 'image/png'
    },
    { name: 'a non-media file', size: 4, type: 'text/plain' }
  ])('rejects $name before requesting a grant', async ({ size, type }) => {
    const f = fixture()
    const file = new File([new Uint8Array(size)], 'source', { type })

    await expect(
      f.upload(file, new AbortController().signal)
    ).rejects.toMatchObject({ code: 'invalid_input' })
    expect(f.fetch).not.toHaveBeenCalled()
  })

  it('accepts a file at the input size limit', async () => {
    const f = fixture()
    const file = new File([new Uint8Array(WORKFLOW_FILE_BYTES)], 'source.png', {
      type: 'image/png'
    })

    expect(await f.upload(file, new AbortController().signal)).toBe(
      'input-hash'
    )
  })

  it.for([
    {
      name: 'a path instead of a loader reference',
      response: { ...result, name: '../private.png' }
    },
    {
      name: 'an inline URL instead of a loader reference',
      response: { ...result, name: 'data:image/png;base64,private' }
    },
    { name: 'a non-input asset', response: { ...result, type: 'output' } },
    {
      name: 'a nonempty subfolder',
      response: { ...result, subfolder: 'private' }
    }
  ])('rejects $name from the upload response', async ({ response }) => {
    const f = fixture()
    f.fetch
      .mockReset()
      .mockResolvedValueOnce(Response.json(grant))
      .mockResolvedValueOnce(Response.json(response))

    await expect(
      f.upload(f.file, new AbortController().signal)
    ).rejects.toMatchObject({ code: 'response' })
  })

  it.for([
    { name: 'a failed download', status: 403, type: 'image/png', length: 4 },
    { name: 'a non-media download', status: 200, type: 'text/html', length: 4 },
    {
      name: 'an oversized declared download',
      status: 200,
      type: 'image/png',
      length: WORKFLOW_FILE_BYTES + 1
    }
  ])(
    'rejects $name before requesting a grant',
    async ({ status, type, length }) => {
      const f = fixture()
      f.fetch.mockReset().mockResolvedValueOnce(
        new Response(bytes, {
          status,
          headers: { 'Content-Type': type, 'Content-Length': String(length) }
        })
      )

      await expect(
        f.upload(
          'https://media.example/source.png',
          new AbortController().signal
        )
      ).rejects.toMatchObject({
        code: 'media_unavailable'
      })
      expect(f.fetch).toHaveBeenCalledOnce()
    }
  )

  it('cancels an oversized chunked source download before requesting a grant', async () => {
    const f = fixture()
    let reads = 0
    const cancel = vi.fn()
    const body = new ReadableStream<Uint8Array>(
      {
        pull(controller) {
          reads++
          controller.enqueue(new Uint8Array(WORKFLOW_FILE_BYTES))
        },
        cancel
      },
      { highWaterMark: 0 }
    )
    f.fetch
      .mockReset()
      .mockResolvedValueOnce(
        new Response(body, { headers: { 'Content-Type': 'image/png' } })
      )

    await expect(
      f.upload('https://media.example/source.png', new AbortController().signal)
    ).rejects.toMatchObject({
      code: 'payload_too_large'
    })
    expect(reads).toBe(2)
    expect(cancel).toHaveBeenCalledOnce()
    expect(f.fetch).toHaveBeenCalledOnce()
  })
})
