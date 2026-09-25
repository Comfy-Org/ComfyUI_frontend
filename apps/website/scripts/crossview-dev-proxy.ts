/**
 * Local stand-in for the app proxy, for developing Re-shoot only.
 *
 * A Comfy API deployment takes an API key, and a static site has nowhere to
 * keep one, so this forwards /api/v2/* to the deployment and adds the key on
 * the way. It runs on the developer's machine and nowhere else; the site
 * reaches it only under `astro dev` (PUBLIC_CROSSVIEW_PROXY).
 *
 *   CROSSVIEW_DEPLOYMENT_URL=https://dep-….run.comfy.app \
 *   COMFY_API_KEY=… pnpm --filter @comfyorg/website dev:crossview-proxy
 *
 * Both values may instead live as `export NAME=value` lines in
 * ~/.config/comfy-workshop/crossview.env or deployment.env.
 */
import { readFileSync } from 'node:fs'
import type {
  IncomingHttpHeaders,
  IncomingMessage,
  ServerResponse
} from 'node:http'
import { createServer } from 'node:http'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { Readable } from 'node:stream'
import type { ReadableStream as NodeReadableStream } from 'node:stream/web'

import { isDirectExecution } from './script-entry-point'

const ENV_FILES = ['deployment.env', 'crossview.env']
const FORWARDED = ['content-type', 'idempotency-key']
const LOCAL = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/

/** `NAME=value` and `export NAME="value"` lines; anything else is ignored. */
export function parseEnvFile(text: string): Record<string, string> {
  const entries = text
    .split('\n')
    .map((line) => line.trim().match(/^(?:export\s+)?(\w+)=(.*)$/))
    .flatMap((m) => (m ? [[m[1], m[2].replace(/^["']|["']$/g, '')]] : []))
  return Object.fromEntries(entries)
}

function readEnvFile(name: string): string {
  try {
    return readFileSync(join(homedir(), '.config/comfy-workshop', name), 'utf8')
  } catch {
    return ''
  }
}

export interface ProxyConfig {
  readonly target: string
  readonly key: string
}

/** The process environment wins over the files; undefined if either is missing. */
export function proxyConfig(
  env: Partial<Record<string, string>>,
  files: Partial<Record<string, string>>
): ProxyConfig | undefined {
  const target = (
    env.CROSSVIEW_DEPLOYMENT_URL ??
    files.CROSSVIEW_DEPLOYMENT_URL ??
    ''
  ).replace(/\/$/, '')
  const key = env.COMFY_API_KEY ?? files.COMFY_API_KEY
  return target && key ? { target, key } : undefined
}

export function corsHeaders(
  origin: string | undefined
): Record<string, string> {
  if (!origin || !LOCAL.test(origin)) return {}
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': FORWARDED.join(', ')
  }
}

export function upstreamHeaders(
  incoming: IncomingHttpHeaders,
  key: string
): Record<string, string> {
  const passed = FORWARDED.flatMap((name) => {
    const value = incoming[name]
    return typeof value === 'string' ? [[name, value]] : []
  })
  return { authorization: `Bearer ${key}`, ...Object.fromEntries(passed) }
}

/** What to do with a request before it reaches the deployment. */
export function route(
  method: string | undefined,
  url: string
): 'preflight' | 'forward' | 'notFound' {
  if (method === 'OPTIONS') return 'preflight'
  return url.startsWith('/api/v2/') ? 'forward' : 'notFound'
}

async function forward(
  req: IncomingMessage,
  res: ServerResponse,
  { target, key }: ProxyConfig
) {
  const hasBody = req.method !== 'GET' && req.method !== 'HEAD'
  // Redirects to signed storage are followed here; fetch drops the key on
  // the way to another origin.
  const upstream = await fetch(target + String(req.url), {
    method: req.method,
    headers: upstreamHeaders(req.headers, key),
    body: hasBody ? (Readable.toWeb(req) as ReadableStream) : undefined,
    // required by Node for a streamed request body
    ...(hasBody ? { duplex: 'half' } : {})
  })
  const type = upstream.headers.get('content-type')
  res.writeHead(upstream.status, type ? { 'content-type': type } : {})
  if (upstream.body)
    Readable.fromWeb(upstream.body as NodeReadableStream).pipe(res)
  else res.end()
  process.stdout.write(`${req.method} ${req.url} -> ${upstream.status}\n`)
}

function handler(config: ProxyConfig) {
  return async (req: IncomingMessage, res: ServerResponse) => {
    for (const [name, value] of Object.entries(corsHeaders(req.headers.origin)))
      res.setHeader(name, value)
    const next = route(req.method, String(req.url))
    if (next !== 'forward') {
      res.writeHead(next === 'preflight' ? 204 : 404).end()
      return
    }
    try {
      await forward(req, res, config)
    } catch (error) {
      console.error(error)
      res.writeHead(502, { 'content-type': 'application/json' })
      res.end(JSON.stringify({ error: String(error) }))
    }
  }
}

function main() {
  const files = Object.assign(
    {},
    ...ENV_FILES.map((name) => parseEnvFile(readEnvFile(name)))
  )
  const config = proxyConfig(process.env, files)
  if (!config) {
    console.error(
      'crossview-dev-proxy: set CROSSVIEW_DEPLOYMENT_URL and COMFY_API_KEY'
    )
    process.exit(1)
  }
  const port = Number(process.env.CROSSVIEW_PROXY_PORT ?? 4329)
  createServer(handler(config)).listen(port, '127.0.0.1', () =>
    process.stdout.write(
      `crossview-dev-proxy: http://127.0.0.1:${port} -> ${config.target}\n`
    )
  )
}

if (isDirectExecution(process.argv[1], import.meta.filename)) main()
