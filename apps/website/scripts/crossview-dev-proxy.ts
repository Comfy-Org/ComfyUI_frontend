/**
 * Local stand-in for a real backend, for the CrossView Warp demo only.
 *
 * A Comfy API deployment takes an API key, and a static site has nowhere to
 * keep one, so this forwards /api/v2/* to the deployment and adds the key on
 * the way. It runs on the developer's machine and nowhere else; production
 * needs a proper server-side route, which is the backend's to build.
 *
 *   CROSSVIEW_DEPLOYMENT_URL=https://dep-….run.comfy.app \
 *   COMFY_API_KEY=… pnpm --filter @comfyorg/website dev:crossview-proxy
 *
 * Both values may instead live as `export NAME=value` lines in
 * ~/.config/comfy-workshop/crossview.env or deployment.env.
 */
import { readFileSync } from 'node:fs'
import { createServer } from 'node:http'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { Readable } from 'node:stream'
import type { ReadableStream as NodeReadableStream } from 'node:stream/web'

const PORT = Number(process.env.CROSSVIEW_PROXY_PORT ?? 4329)

function fromEnvFiles(): Partial<Record<string, string>> {
  const out: Record<string, string> = {}
  for (const name of ['deployment.env', 'crossview.env']) {
    try {
      const text = readFileSync(
        join(homedir(), '.config/comfy-workshop', name),
        'utf8'
      )
      for (const line of text.split('\n')) {
        const m = line.trim().match(/^(?:export\s+)?(\w+)=(.*)$/)
        if (m) out[m[1]] = m[2].replace(/^["']|["']$/g, '')
      }
    } catch {
      // a missing file just means the value has to come from the environment
    }
  }
  return out
}

const files = fromEnvFiles()
const target = (
  process.env.CROSSVIEW_DEPLOYMENT_URL ??
  files.CROSSVIEW_DEPLOYMENT_URL ??
  ''
).replace(/\/$/, '')
const key = process.env.COMFY_API_KEY ?? files.COMFY_API_KEY
if (!target || !key) {
  console.error(
    'crossview-dev-proxy: set CROSSVIEW_DEPLOYMENT_URL and COMFY_API_KEY'
  )
  process.exit(1)
}

const LOCAL = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/

createServer(async (req, res) => {
  const origin = req.headers.origin
  if (origin && LOCAL.test(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin)
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
    res.setHeader(
      'Access-Control-Allow-Headers',
      'content-type, idempotency-key'
    )
  }
  if (req.method === 'OPTIONS') {
    res.writeHead(204).end()
    return
  }
  const url = String(req.url)
  if (!url.startsWith('/api/v2/')) {
    res.writeHead(404).end()
    return
  }

  try {
    const headers: Record<string, string> = { authorization: `Bearer ${key}` }
    for (const name of ['content-type', 'idempotency-key']) {
      const value = req.headers[name]
      if (typeof value === 'string') headers[name] = value
    }
    const hasBody = req.method !== 'GET' && req.method !== 'HEAD'
    // Redirects to signed storage are followed here; fetch drops the key on
    // the way to another origin.
    const upstream = await fetch(target + url, {
      method: req.method,
      headers,
      body: hasBody ? (Readable.toWeb(req) as ReadableStream) : undefined,
      // required by Node for a streamed request body
      ...(hasBody ? { duplex: 'half' } : {})
    })
    const type = upstream.headers.get('content-type')
    res.writeHead(upstream.status, type ? { 'content-type': type } : {})
    if (upstream.body)
      Readable.fromWeb(upstream.body as NodeReadableStream).pipe(res)
    else res.end()
    process.stdout.write(`${req.method} ${url} -> ${upstream.status}\n`)
  } catch (error) {
    console.error(error)
    res.writeHead(502, { 'content-type': 'application/json' })
    res.end(JSON.stringify({ error: String(error) }))
  }
}).listen(PORT, '127.0.0.1', () =>
  process.stdout.write(
    `crossview-dev-proxy: http://127.0.0.1:${PORT} -> ${target}\n`
  )
)
