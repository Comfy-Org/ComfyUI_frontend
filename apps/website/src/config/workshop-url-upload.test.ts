import { describe, expect, it, vi } from 'vitest'

import type { operations } from '@comfyorg/registry-types'

import { createWorkshopUrlUploader } from './workshop-url-upload'
import { WORKSHOP_ROUTER_BASE_URL } from './workshop-env'

const grant = {
  upload_url: 'https://storage.googleapis.com/test/input?signature=upload',
  download_url: 'https://storage.googleapis.com/test/input?signature=download',
  expires_at: '2099-01-01T00:00:00Z'
}
type StorageBody =
  operations['createCustomerStorageResource']['requestBody']['content']['application/json']

describe('URL upload transport', () => {
  it('uploads the exact bytes without forwarding Comfy credentials and reuses completed uploads for retries', async () => {
    const names: string[] = []
    const bytes = new Uint8Array([0, 255, 13, 34])
    const file = new File([bytes], '../image.png', { type: 'image/png' })
    const requests = vi.fn<typeof fetch>(async (url, init) => {
      if (!init) throw new Error('Missing upload request')
      expect(init.credentials).toBe('omit')
      expect(init.redirect).toBe('error')
      const headers = new Headers(init.headers)
      if (init.method === 'POST') {
        expect(url).toBe(`${WORKSHOP_ROUTER_BASE_URL}/customers/storage`)
        expect(headers.get('Authorization')).toBe('Bearer workspace-token')
        const body: StorageBody = JSON.parse(String(init.body))
        names.push(body.file_name)
        expect(body.content_type).toBe('image/png')
        expect(body.file_name).toMatch(/^[a-f0-9-]+-image\.png$/)
        return Response.json(grant)
      }
      expect(init.method).toBe('PUT')
      expect(url).toBe(grant.upload_url)
      expect(headers.has('Authorization')).toBe(false)
      expect(headers.get('Content-Type')).toBe('image/png')
      if (!(init.body instanceof File)) throw new Error('Expected file bytes')
      expect(new Uint8Array(await init.body.arrayBuffer())).toEqual(bytes)
      return new Response(null, { status: 200 })
    })
    vi.stubGlobal('fetch', requests)
    const upload = createWorkshopUrlUploader()
    const signal = new AbortController().signal
    expect(
      await upload(file, 'workspace-token', 'owner:workspace', signal)
    ).toBe(grant.download_url)
    expect(
      await upload(file, 'workspace-token', 'owner:workspace', signal)
    ).toBe(grant.download_url)
    expect(requests).toHaveBeenCalledTimes(2)
    await upload(
      new File([bytes], file.name, { type: file.type }),
      'workspace-token',
      'owner:workspace',
      signal
    )
    expect(new Set(names).size).toBe(2)
    await upload(file, 'workspace-token', 'owner:another-workspace', signal)
    expect(requests).toHaveBeenCalledTimes(6)
  })

  it('does not cache a failed PUT and respects the actual grant expiry with a safety margin', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-09-10T10:00:00Z'))
    const shortGrant = { ...grant, expires_at: '2026-09-10T10:10:00Z' }
    const requests = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(Response.json(shortGrant))
      .mockResolvedValueOnce(new Response(null, { status: 403 }))
      .mockResolvedValueOnce(Response.json(shortGrant))
      .mockResolvedValueOnce(new Response(null, { status: 200 }))
      .mockResolvedValueOnce(Response.json(grant))
      .mockResolvedValueOnce(new Response(null, { status: 200 }))
    vi.stubGlobal('fetch', requests)
    const upload = createWorkshopUrlUploader()
    const file = new File(['image'], 'image.png', { type: 'image/png' })
    const signal = new AbortController().signal
    await expect(upload(file, 'token', 'scope', signal)).rejects.toThrow(
      'Upload failed'
    )
    expect(await upload(file, 'token', 'scope', signal)).toBe(
      grant.download_url
    )
    vi.setSystemTime(new Date('2026-09-10T10:08:59Z'))
    await upload(file, 'token', 'scope', signal)
    expect(requests).toHaveBeenCalledTimes(4)
    vi.setSystemTime(new Date('2026-09-10T10:09:00Z'))
    await upload(file, 'token', 'scope', signal)
    expect(requests).toHaveBeenCalledTimes(6)
  })

  it('reuses the backend two-field grant for its documented 24-hour lifetime', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-09-10T10:00:00Z'))
    const requests = vi.fn<typeof fetch>(async (_, init) =>
      init?.method === 'POST'
        ? Response.json({
            upload_url: grant.upload_url,
            download_url: grant.download_url
          })
        : new Response(null, { status: 200 })
    )
    vi.stubGlobal('fetch', requests)
    const upload = createWorkshopUrlUploader()
    const file = new File(['image'], 'image.png')
    const signal = new AbortController().signal
    await upload(file, 'token', 'scope', signal)
    vi.setSystemTime(new Date('2026-09-11T09:58:59Z'))
    await upload(file, 'token', 'scope', signal)
    expect(requests).toHaveBeenCalledTimes(2)
    vi.setSystemTime(new Date('2026-09-11T09:59:00Z'))
    await upload(file, 'token', 'scope', signal)
    expect(requests).toHaveBeenCalledTimes(4)
  })

  it('rejects an invalid explicit expiry before uploading', async () => {
    const requests = vi
      .fn<typeof fetch>()
      .mockResolvedValue(Response.json({ ...grant, expires_at: 'invalid' }))
    vi.stubGlobal('fetch', requests)
    await expect(
      createWorkshopUrlUploader()(
        new File(['private'], 'image.png'),
        'token',
        'scope',
        new AbortController().signal
      )
    ).rejects.toThrow('Invalid upload expiry')
    expect(requests).toHaveBeenCalledTimes(1)
  })

  it('rejects an already-expired grant before sending private bytes', async () => {
    const requests = vi
      .fn<typeof fetch>()
      .mockResolvedValue(
        Response.json({ ...grant, expires_at: '2000-01-01T00:00:00Z' })
      )
    vi.stubGlobal('fetch', requests)
    await expect(
      createWorkshopUrlUploader()(
        new File(['private'], 'image.png'),
        'token',
        'scope',
        new AbortController().signal
      )
    ).rejects.toThrow('expired')
    expect(requests).toHaveBeenCalledTimes(1)
  })

  it.for([
    {
      upload_url: 'http://storage.example/input',
      download_url: grant.download_url
    },
    {
      upload_url: 'https://user:password@storage.example/input',
      download_url: grant.download_url
    },
    { upload_url: grant.upload_url },
    { upload_url: grant.upload_url, download_url: 'javascript:alert(1)' }
  ])(
    'rejects an invalid grant before transmitting private bytes: %j',
    async (response) => {
      const requests = vi
        .fn<typeof fetch>()
        .mockResolvedValue(Response.json(response))
      vi.stubGlobal('fetch', requests)
      await expect(
        createWorkshopUrlUploader()(
          new File(['private'], 'image.png'),
          'token',
          'scope',
          new AbortController().signal
        )
      ).rejects.toThrow()
      expect(requests).toHaveBeenCalledTimes(1)
    }
  )

  it('cancels between grant and PUT without uploading or caching the file', async () => {
    const controller = new AbortController()
    const requests = vi.fn<typeof fetch>(async () => {
      controller.abort()
      return Response.json(grant)
    })
    vi.stubGlobal('fetch', requests)
    await expect(
      createWorkshopUrlUploader()(
        new File(['private'], 'image.png'),
        'token',
        'scope',
        controller.signal
      )
    ).rejects.toMatchObject({ name: 'AbortError' })
    expect(requests).toHaveBeenCalledTimes(1)
  })

  it('does not cache a late PUT completion after its timeout', async () => {
    const timeout = new AbortController()
    vi.spyOn(AbortSignal, 'timeout').mockReturnValueOnce(timeout.signal)
    const requests = vi.fn<typeof fetch>(async (_, init) => {
      if (init?.method === 'POST') return Response.json(grant)
      timeout.abort(new DOMException('Upload timed out', 'TimeoutError'))
      return new Response(null, { status: 200 })
    })
    vi.stubGlobal('fetch', requests)
    const upload = createWorkshopUrlUploader()
    const file = new File(['private'], 'image.png')
    const signal = new AbortController().signal
    await expect(upload(file, 'token', 'scope', signal)).rejects.toMatchObject({
      name: 'TimeoutError'
    })
    expect(await upload(file, 'token', 'scope', signal)).toBe(
      grant.download_url
    )
    expect(requests).toHaveBeenCalledTimes(4)
  })
})
