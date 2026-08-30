import type { IncomingMessage, ServerResponse } from 'node:http'
import { Readable } from 'node:stream'
import type { ReadableStream as NodeReadableStream } from 'node:stream/web'

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
    location?.includes('storage.googleapis.com') &&
    proxyRes.headers.via?.includes('google')

  // Not a GCS redirect - pass through normally
  if (!isGcsRedirect || !location) {
    Object.keys(proxyRes.headers).forEach((key) => {
      const value = proxyRes.headers[key]
      if (value !== undefined) {
        res.setHeader(key, value)
      }
    })
    res.writeHead(proxyRes.statusCode || 200)
    proxyRes.pipe(res)
    return
  }

  // GCS redirect detected - fetch server-side to avoid CORS. Range headers
  // are forwarded and the partial-content response relayed so ranged reads
  // behave like production, where the browser talks to GCS directly.
  const rangeHeader = req.headers.range
  fetch(location, rangeHeader ? { headers: { range: rangeHeader } } : undefined)
    .then(async (gcsResponse) => {
      if (!gcsResponse.body) {
        res.statusCode = 500
        res.end('Empty response from GCS')
        return
      }

      // Set response headers from GCS
      res.statusCode = gcsResponse.status
      res.setHeader(
        'Content-Type',
        gcsResponse.headers.get('content-type') || 'application/octet-stream'
      )

      for (const header of [
        'content-length',
        'content-range',
        'accept-ranges',
        'cache-control',
        'etag',
        'last-modified'
      ]) {
        const value = gcsResponse.headers.get(header)
        if (value) {
          res.setHeader(header, value)
        }
      }

      // Convert Web ReadableStream to Node.js stream and pipe to client
      const readable = Readable.fromWeb(gcsResponse.body as NodeReadableStream)
      readable.pipe(res)
    })
    .catch((error) => {
      console.error('Error fetching from GCS:', error)
      res.statusCode = 500
      res.end('Error fetching media')
    })
}
