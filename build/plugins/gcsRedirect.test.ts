import type { IncomingMessage, ServerResponse } from 'node:http'
import { PassThrough } from 'node:stream'
import { describe, expect, it, vi } from 'vitest'

import { handleGcsRedirect } from './gcsRedirect'

function createProxyRes(
  headers: Record<string, string>,
  statusCode: number
): IncomingMessage {
  const stream = new PassThrough() as PassThrough & {
    headers: Record<string, string>
    statusCode: number
  }
  stream.headers = headers
  stream.statusCode = statusCode
  return stream as unknown as IncomingMessage
}

function createRes() {
  const stream = new PassThrough() as PassThrough & {
    setHeader: ReturnType<typeof vi.fn>
    writeHead: ReturnType<typeof vi.fn>
    statusCode: number
  }
  stream.setHeader = vi.fn()
  stream.writeHead = vi.fn()
  return stream
}

function createReq(headers: Record<string, string> = {}): IncomingMessage {
  return { headers } as unknown as IncomingMessage
}

function gcsResponse(headers: Record<string, string>) {
  return {
    status: 200,
    headers: new Headers(headers),
    body: new ReadableStream({
      start(controller) {
        controller.enqueue(new Uint8Array([1, 2]))
        controller.close()
      }
    })
  }
}

const GCS_REDIRECT_HEADERS = {
  location: 'https://storage.googleapis.com/bucket/object.mp4',
  via: '1.1 google'
}

describe('handleGcsRedirect', () => {
  it('passes non-redirect responses through with their headers', () => {
    const proxyRes = createProxyRes(
      { 'content-type': 'application/json', 'x-custom': 'yes' },
      200
    )
    const res = createRes()

    handleGcsRedirect(proxyRes, createReq(), res as unknown as ServerResponse)

    expect(res.setHeader).toHaveBeenCalledWith(
      'content-type',
      'application/json'
    )
    expect(res.setHeader).toHaveBeenCalledWith('x-custom', 'yes')
    expect(res.writeHead).toHaveBeenCalledWith(200)
  })

  it('forwards content and caching headers from the GCS response', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      gcsResponse({
        'content-type': 'video/mp4',
        'content-length': '2',
        'accept-ranges': 'bytes',
        'cache-control': 'public, max-age=3600',
        etag: '"abc123"',
        'last-modified': 'Wed, 01 Jan 2025 00:00:00 GMT'
      })
    )
    vi.stubGlobal('fetch', fetchMock)
    const res = createRes()

    handleGcsRedirect(
      createProxyRes(GCS_REDIRECT_HEADERS, 302),
      createReq(),
      res as unknown as ServerResponse
    )

    await vi.waitFor(() => {
      expect(res.setHeader).toHaveBeenCalledWith('Content-Type', 'video/mp4')
    })
    expect(res.setHeader).toHaveBeenCalledWith('content-length', '2')
    expect(res.setHeader).toHaveBeenCalledWith('accept-ranges', 'bytes')
    expect(res.setHeader).toHaveBeenCalledWith(
      'cache-control',
      'public, max-age=3600'
    )
    expect(res.setHeader).toHaveBeenCalledWith('etag', '"abc123"')
    expect(res.setHeader).toHaveBeenCalledWith(
      'last-modified',
      'Wed, 01 Jan 2025 00:00:00 GMT'
    )
    expect(res.statusCode).toBe(200)
  })

  it('treats a 302 to a non-GCS host as a plain pass-through', () => {
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
    const res = createRes()

    const proxyRes = createProxyRes(
      { location: 'https://elsewhere.example.com/obj', via: '1.1 google' },
      302
    )
    const pipe = vi.spyOn(proxyRes, 'pipe')

    handleGcsRedirect(proxyRes, createReq(), res as unknown as ServerResponse)

    expect(fetchMock).not.toHaveBeenCalled()
    expect(res.setHeader).toHaveBeenCalledWith(
      'location',
      'https://elsewhere.example.com/obj'
    )
    expect(res.writeHead).toHaveBeenCalledWith(302)
    expect(pipe).toHaveBeenCalledExactlyOnceWith(res)
  })

  it('treats a 302 with no location at all as a plain pass-through', () => {
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
    const res = createRes()
    const proxyRes = createProxyRes({ via: '1.1 google' }, 302)
    const pipe = vi.spyOn(proxyRes, 'pipe')

    handleGcsRedirect(proxyRes, createReq(), res as unknown as ServerResponse)

    expect(fetchMock).not.toHaveBeenCalled()
    expect(res.writeHead).toHaveBeenCalledWith(302)
    expect(pipe).toHaveBeenCalledExactlyOnceWith(res)
  })

  it('relays a partial-content status with its content-range', async () => {
    const partial = gcsResponse({
      'content-type': 'video/mp4',
      'content-range': 'bytes 0-1/2',
      'content-length': '2'
    })
    partial.status = 206
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(partial))
    const res = createRes()

    handleGcsRedirect(
      createProxyRes(GCS_REDIRECT_HEADERS, 302),
      createReq({ range: 'bytes=0-1' }),
      res as unknown as ServerResponse
    )

    await vi.waitFor(() => {
      expect(res.setHeader).toHaveBeenCalledWith('content-range', 'bytes 0-1/2')
    })
    expect(res.statusCode).toBe(206)
  })

  it('forwards the range header to GCS', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(gcsResponse({ 'content-type': 'video/mp4' }))
    vi.stubGlobal('fetch', fetchMock)

    handleGcsRedirect(
      createProxyRes(GCS_REDIRECT_HEADERS, 302),
      createReq({ range: 'bytes=0-1' }),
      createRes() as unknown as ServerResponse
    )

    await vi.waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(GCS_REDIRECT_HEADERS.location, {
        headers: { range: 'bytes=0-1' }
      })
    })
  })

  it('responds 500 when the GCS fetch fails', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('boom')))
    const res = createRes()
    const endSpy = vi.spyOn(res, 'end')

    handleGcsRedirect(
      createProxyRes(GCS_REDIRECT_HEADERS, 302),
      createReq(),
      res as unknown as ServerResponse
    )

    await vi.waitFor(() => {
      expect(endSpy).toHaveBeenCalledWith('Error fetching media')
    })
    expect(res.statusCode).toBe(500)
  })
})
