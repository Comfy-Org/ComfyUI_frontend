import type { IncomingMessage, ServerResponse } from 'node:http'
import { Readable } from 'node:stream'
import { pipeline } from 'node:stream/promises'
import type { ReadableStream as NodeReadableStream } from 'node:stream/web'

function isTrustedGcsUrl(location: string | undefined): location is string {
  if (!location) return false
  try {
    const url = new URL(location)
    return url.origin === 'https://storage.googleapis.com'
  } catch {
    return false
  }
}

/**
 * Dev-only (cloud distribution): the ComfyUI proxy answers media requests
 * with a 302 to GCS; the browser cannot follow it cross-origin, so the dev
 * server fetches server-side and relays body, range, and freshness headers.
 */
export function handleGcsRedirect(
  proxyRes: IncomingMessage,
  req: IncomingMessage,
  res: ServerResponse
) {
  const location = proxyRes.headers.location
  const isGcsRedirect =
    proxyRes.statusCode === 302 &&
    isTrustedGcsUrl(location) &&
    proxyRes.headers.via?.includes('google')

  if (!isGcsRedirect || !location) {
    Object.keys(proxyRes.headers).forEach((key) => {
      const value = proxyRes.headers[key]
      if (value !== undefined) res.setHeader(key, value)
    })
    res.writeHead(proxyRes.statusCode || 200)
    proxyRes.pipe(res)
    return
  }

  proxyRes.resume()
  const rangeHeader = req.headers.range
  fetch(location, {
    headers: rangeHeader ? { range: rangeHeader } : undefined,
    redirect: 'manual'
  })
    .then(async (gcsResponse) => {
      if (!gcsResponse.body) {
        res.statusCode = 500
        res.end('Empty response from GCS')
        return
      }

      res.statusCode = gcsResponse.status
      res.setHeader(
        'Content-Type',
        gcsResponse.headers.get('content-type') || 'application/octet-stream'
      )

      const responseHeaders = [
        ...(gcsResponse.headers.has('content-encoding')
          ? []
          : ['content-length']),
        'content-range',
        'accept-ranges',
        'cache-control',
        'etag',
        'last-modified'
      ]
      for (const header of responseHeaders) {
        const value = gcsResponse.headers.get(header)
        if (value) res.setHeader(header, value)
      }

      const readable = Readable.fromWeb(gcsResponse.body as NodeReadableStream)
      await pipeline(readable, res)
    })
    .catch((error) => {
      console.error('Error fetching from GCS:', error)
      if (!res.headersSent) res.statusCode = 500
      if (!res.writableEnded && !res.destroyed) res.end('Error fetching media')
    })
}
