import type { IncomingMessage, ServerResponse } from 'node:http'
import { PassThrough } from 'node:stream'
import { describe, expect, it, vi } from 'vitest'

import { handleGcsRedirect } from './gcsRedirect'

function proxyResponse(headers: Record<string, string>, statusCode = 302) {
  const stream = new PassThrough() as PassThrough & {
    headers: Record<string, string>
    statusCode: number
  }
  stream.headers = headers
  stream.statusCode = statusCode
  return stream as unknown as IncomingMessage
}

function request(headers: Record<string, string> = {}) {
  return { headers } as unknown as IncomingMessage
}

function response() {
  const stream = new PassThrough() as PassThrough & {
    setHeader: ReturnType<typeof vi.fn>
    writeHead: ReturnType<typeof vi.fn>
    statusCode: number
  }
  stream.setHeader = vi.fn()
  stream.writeHead = vi.fn()
  return stream
}

function fetchedResponse(headers: Record<string, string> = {}) {
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

const trustedHeaders = {
  location: 'https://storage.googleapis.com/bucket/object.mp4',
  via: '1.1 google'
}

describe('handleGcsRedirect', () => {
  it.for([
    'https://storage.googleapis.com.attacker.example/obj',
    'http://127.0.0.1/?next=storage.googleapis.com',
    'http://storage.googleapis.com/bucket/object.mp4'
  ])('does not server-fetch an untrusted redirect URL: %s', (location) => {
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
    const proxyRes = proxyResponse({ location, via: '1.1 google' })
    const pipe = vi.spyOn(proxyRes, 'pipe')

    handleGcsRedirect(
      proxyRes,
      request(),
      response() as unknown as ServerResponse
    )

    expect(fetchMock).not.toHaveBeenCalled()
    expect(pipe).toHaveBeenCalledOnce()
  })

  it('uses manual redirects and forwards range requests', async () => {
    const fetchMock = vi.fn().mockResolvedValue(fetchedResponse())
    vi.stubGlobal('fetch', fetchMock)

    handleGcsRedirect(
      proxyResponse(trustedHeaders),
      request({ range: 'bytes=0-1' }),
      response() as unknown as ServerResponse
    )

    await vi.waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(trustedHeaders.location, {
        headers: { range: 'bytes=0-1' },
        redirect: 'manual'
      })
    )
  })

  it('omits a stale encoded length after fetch decodes the body', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        fetchedResponse({
          'content-encoding': 'gzip',
          'content-length': '20'
        })
      )
    )
    const res = response()

    handleGcsRedirect(
      proxyResponse(trustedHeaders),
      request(),
      res as unknown as ServerResponse
    )

    await vi.waitFor(() => expect(res.statusCode).toBe(200))
    expect(res.setHeader).not.toHaveBeenCalledWith('content-length', '20')
  })

  it('handles failures emitted while streaming the response', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        status: 200,
        headers: new Headers(),
        body: new ReadableStream({
          start(controller) {
            controller.error(new Error('stream reset'))
          }
        })
      })
    )

    handleGcsRedirect(
      proxyResponse(trustedHeaders),
      request(),
      response() as unknown as ServerResponse
    )

    await vi.waitFor(() =>
      expect(consoleError).toHaveBeenCalledWith(
        'Error fetching from GCS:',
        expect.objectContaining({ message: 'stream reset' })
      )
    )
  })

  it('returns an error when GCS responds without a body', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        status: 200,
        headers: new Headers(),
        body: null
      })
    )
    const res = response()
    const end = vi.spyOn(res, 'end')

    handleGcsRedirect(
      proxyResponse(trustedHeaders),
      request(),
      res as unknown as ServerResponse
    )

    await vi.waitFor(() => {
      expect(res.statusCode).toBe(500)
      expect(end).toHaveBeenCalledWith('Empty response from GCS')
    })
  })

  it('returns an error when the GCS fetch rejects', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('fetch failed')))
    const res = response()
    const end = vi.spyOn(res, 'end')

    handleGcsRedirect(
      proxyResponse(trustedHeaders),
      request(),
      res as unknown as ServerResponse
    )

    await vi.waitFor(() => {
      expect(res.statusCode).toBe(500)
      expect(end).toHaveBeenCalledWith('Error fetching media')
    })
  })
})
