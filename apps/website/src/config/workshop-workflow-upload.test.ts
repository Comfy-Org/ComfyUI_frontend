import { describe, expect, it, vi } from 'vitest'

import { createWorkflowApi } from './workshop-workflow-api'
import { WORKFLOW_FILE_BYTES } from './workshop-workflow-response'
import { createWorkflowUploader } from './workshop-workflow-upload'

const id = '8b9a8b50-9fd5-4bbe-a03a-2a387f09713b'
const inputUrl = `https://storage.googleapis.com/inputs/${id}`
const path = `/customers/storage/${id}/access`
const expiry = new Date(Date.now() + 600_000).toISOString()

function fixture(type: string) {
  const file = new File([new Uint8Array([1, 2, 3, 4])], 'private-file', {
    type
  })
  const grant = {
    upload_url: `${inputUrl}?upload=signature`,
    workflow_upload: {
      id,
      inputUrl,
      accessUrl: path,
      uploadExpiresAt: expiry,
      assetExpiresAt: expiry,
      uploadHeaders: {
        'Content-Type': type,
        'x-goog-if-generation-match': '0',
        'x-goog-content-length-range': '4,4',
        'Cache-Control': 'private, no-store'
      }
    }
  }
  const access = {
    url: `${inputUrl}?download=signature`,
    expiresAt: expiry,
    refreshUrl: path,
    mimeType: type,
    sizeBytes: 4
  }
  const fetch = vi
    .fn<typeof globalThis.fetch>()
    .mockResolvedValueOnce(Response.json(grant))
    .mockResolvedValueOnce(new Response(null, { status: 200 }))
    .mockResolvedValueOnce(Response.json(access))
  const api = createWorkflowApi({ fetch, token: 'caller-only' })
  return {
    file,
    grant,
    access,
    fetch,
    api,
    upload: createWorkflowUploader(api, fetch)
  }
}

describe('Workflow direct uploads', () => {
  it.for(['image/png', 'video/mp4', 'audio/wav'])(
    'uploads %s bytes separately and retains only the stable input URL',
    async (type) => {
      const f = fixture(type)
      const signal = new AbortController().signal
      expect(await f.upload(f.file, signal)).toBe(inputUrl)
      expect(await f.upload(f.file, signal)).toBe(inputUrl)
      expect(f.fetch).toHaveBeenCalledTimes(3)
      const [, post] = f.fetch.mock.calls[0]
      expect(JSON.parse(String(post?.body))).toEqual({
        purpose: 'workshop_workflow',
        file_name: 'workflow-input',
        content_type: type,
        size_bytes: 4
      })
      const [url, put] = f.fetch.mock.calls[1]
      expect(String(url)).toBe(f.grant.upload_url)
      expect(put).toMatchObject({
        method: 'PUT',
        body: f.file,
        credentials: 'omit',
        redirect: 'error'
      })
      expect(new Headers(put?.headers).has('Authorization')).toBe(false)
      expect(new Headers(put?.headers).get('x-goog-if-generation-match')).toBe(
        '0'
      )
      expect(String(f.fetch.mock.calls[2][0])).toContain(path)
    }
  )

  it.for(['lost PUT response', 'signer failure'])(
    'recovers %s through finalization without uploading again',
    async (failure) => {
      const f = fixture('image/png')
      f.fetch.mockReset().mockResolvedValueOnce(Response.json(f.grant))
      if (failure === 'lost PUT response')
        f.fetch.mockRejectedValueOnce(new TypeError('private transport error'))
      else
        f.fetch
          .mockResolvedValueOnce(new Response(null, { status: 200 }))
          .mockResolvedValueOnce(
            Response.json(
              { error: { code: 'delivery_failed', message: 'safe' } },
              { status: 503 }
            )
          )
      f.fetch.mockResolvedValueOnce(Response.json(f.access))
      const signal = new AbortController().signal
      await expect(f.upload(f.file, signal)).rejects.toMatchObject({
        code: 'delivery_failed'
      })
      expect(await f.upload(f.file, signal)).toBe(inputUrl)
      expect(
        f.fetch.mock.calls.filter(([, init]) => init?.method === 'PUT')
      ).toHaveLength(1)
      expect(
        f.fetch.mock.calls.filter(([, init]) => init?.method === 'POST')
      ).toHaveLength(1)
    }
  )

  it('reuses an unexpired immutable grant when finalization is still pending', async () => {
    const f = fixture('image/png')
    f.fetch
      .mockReset()
      .mockResolvedValueOnce(Response.json(f.grant))
      .mockRejectedValueOnce(new TypeError('private transport error'))
      .mockResolvedValueOnce(
        Response.json(
          { error: { code: 'upload_pending', message: 'pending' } },
          { status: 409 }
        )
      )
      .mockResolvedValueOnce(new Response(null, { status: 200 }))
      .mockResolvedValueOnce(Response.json(f.access))
    const signal = new AbortController().signal
    await expect(f.upload(f.file, signal)).rejects.toMatchObject({
      code: 'delivery_failed'
    })
    expect(await f.upload(f.file, signal)).toBe(inputUrl)
    expect(f.fetch.mock.calls.map(([, init]) => init?.method)).toEqual([
      'POST',
      'PUT',
      'GET',
      'PUT',
      'GET'
    ])
    const uploads = f.fetch.mock.calls.filter(
      ([, init]) => init?.method === 'PUT'
    )
    expect(uploads.map(([url]) => String(url))).toEqual([
      f.grant.upload_url,
      f.grant.upload_url
    ])
    expect(
      uploads.map(([, init]) =>
        new Headers(init?.headers).get('x-goog-if-generation-match')
      )
    ).toEqual(['0', '0'])
  })

  it('retains recovery after an aborted PUT without finalizing for the old caller', async () => {
    const f = fixture('image/png')
    const writing = Promise.withResolvers<void>()
    const written = Promise.withResolvers<Response>()
    f.fetch
      .mockReset()
      .mockResolvedValueOnce(Response.json(f.grant))
      .mockImplementationOnce(() => {
        writing.resolve()
        return written.promise
      })
      .mockResolvedValueOnce(Response.json(f.access))
    const controller = new AbortController()
    const upload = f.upload(f.file, controller.signal)
    await writing.promise
    controller.abort()
    written.resolve(new Response(null, { status: 200 }))
    await expect(upload).rejects.toBe(controller.signal.reason)
    expect(f.fetch).toHaveBeenCalledTimes(2)
    expect(await f.upload(f.file, new AbortController().signal)).toBe(inputUrl)
    expect(f.fetch.mock.calls.map(([, init]) => init?.method)).toEqual([
      'POST',
      'PUT',
      'GET'
    ])
  })

  it('does not share upload references between caller clients', async () => {
    const f = fixture('image/png')
    const signal = new AbortController().signal
    await f.upload(f.file, signal)
    f.fetch
      .mockResolvedValueOnce(Response.json(f.grant))
      .mockResolvedValueOnce(new Response(null, { status: 200 }))
      .mockResolvedValueOnce(Response.json(f.access))
    const another = createWorkflowUploader(
      createWorkflowApi({ fetch: f.fetch, token: 'different-caller' }),
      f.fetch
    )
    await another(f.file, signal)
    expect(
      new Headers(f.fetch.mock.calls[3][1]?.headers).get('Authorization')
    ).toBe('Bearer different-caller')
  })

  it('rejects expired or unsafe grants before sending file bytes', async () => {
    for (const change of [
      { uploadExpiresAt: new Date(0).toISOString() },
      { accessUrl: '/customers/storage/another/access' },
      { uploadHeaders: { Authorization: 'secret' } }
    ]) {
      const f = fixture('image/png')
      f.fetch.mockReset().mockResolvedValueOnce(
        Response.json({
          ...f.grant,
          workflow_upload: { ...f.grant.workflow_upload, ...change }
        })
      )
      await expect(
        f.upload(f.file, new AbortController().signal)
      ).rejects.toMatchObject({ code: 'response' })
      expect(f.fetch).toHaveBeenCalledOnce()
    }
  })

  it('rejects oversized input before requesting storage', async () => {
    const f = fixture('image/png')
    const oversized = new File(
      [new Uint8Array(WORKFLOW_FILE_BYTES + 1)],
      'large.png',
      { type: 'image/png' }
    )
    await expect(
      f.upload(oversized, new AbortController().signal)
    ).rejects.toMatchObject({ code: 'invalid_input' })
    expect(f.fetch).not.toHaveBeenCalled()
  })
})
