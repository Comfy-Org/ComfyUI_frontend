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
import type { IncomingMessage, ServerResponse } from 'node:http'
import { createServer } from 'node:http'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { Readable } from 'node:stream'
import type { ReadableStream as NodeReadableStream } from 'node:stream/web'

const PORT = Number(process.env.CROSSVIEW_PROXY_PORT ?? 4329)

function readConfig(name: string): string {
  try {
    return readFileSync(join(homedir(), '.config/comfy-workshop', name), 'utf8')
  } catch {
    // a missing file just means the value has to come from the environment
    return ''
  }
}

function parseEnv(text: string, into: Record<string, string>) {
  for (const line of text.split('\n')) {
    const m = line.trim().match(/^(?:export\s+)?(\w+)=(.*)$/)
    if (m) into[m[1]] = m[2].replace(/^["']|["']$/g, '')
  }
}

function fromEnvFiles(): Partial<Record<string, string>> {
  const out: Record<string, string> = {}
  for (const name of ['deployment.env', 'crossview.env'])
    parseEnv(readConfig(name), out)
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

/** Only pages served from this machine may call the proxy. */
function allowLocalOrigin(req: IncomingMessage, res: ServerResponse) {
  const origin = req.headers.origin
  if (!origin || !LOCAL.test(origin)) return
  res.setHeader('Access-Control-Allow-Origin', origin)
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'content-type, idempotency-key')
}

/** The page's own headers that the deployment needs, plus the key. */
function forwardHeaders(req: IncomingMessage): Record<string, string> {
  const headers: Record<string, string> = { authorization: `Bearer ${key}` }
  for (const name of ['content-type', 'idempotency-key']) {
    const value = req.headers[name]
    if (typeof value === 'string') headers[name] = value
  }
  return headers
}

const BODILESS = new Set(['GET', 'HEAD'])

function upstreamInit(req: IncomingMessage): RequestInit {
  const headers = forwardHeaders(req)
  if (BODILESS.has(String(req.method))) return { method: req.method, headers }
  // duplex is required by Node for a streamed request body
  return {
    method: req.method,
    headers,
    body: Readable.toWeb(req) as ReadableStream,
    duplex: 'half'
  } as RequestInit
}

async function relay(url: string, req: IncomingMessage, res: ServerResponse) {
  // Redirects to signed storage are followed here; fetch drops the key on
  // the way to another origin.
  const upstream = await fetch(target + url, upstreamInit(req))
  const type = upstream.headers.get('content-type')
  res.writeHead(upstream.status, type ? { 'content-type': type } : {})
  if (upstream.body)
    Readable.fromWeb(upstream.body as NodeReadableStream).pipe(res)
  else res.end()
  process.stdout.write(`${req.method} ${url} -> ${upstream.status}\n`)
}

createServer(async (req, res) => {
  allowLocalOrigin(req, res)
  const url = String(req.url)
  if (req.method === 'OPTIONS') return void res.writeHead(204).end()
  if (!url.startsWith('/api/v2/')) return void res.writeHead(404).end()
  try {
    await relay(url, req, res)
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
