import { chatBodySchema } from './core/modelWire'

/** The only web origin the proxy answers. */
export const PREVIEW_ORIGIN = 'http://localhost:5247'

const UPSTREAM_URL = 'https://openrouter.ai/api/v1/chat/completions'
const KEY_NAME = 'OPENROUTER_API_KEY'
const MODEL_NAME = 'OPENROUTER_MODEL'
const MAX_BODY_BYTES = 400_000

export interface ProxyConfig {
  apiKey: string
  model: string
}

export interface ProxyRequest {
  method: string
  path: string
  origin: string | undefined
  body: string
}

export interface ProxyReply {
  status: number
  headers: Record<string, string>
  body: string | ReadableStream<Uint8Array>
}

interface ProxyDeps {
  config: ProxyConfig
  fetch: typeof fetch
  signal?: AbortSignal
}

function configValue(lines: readonly string[], name: string): string {
  const line = lines.find((candidate) => candidate.startsWith(`${name}=`))
  return (line ?? '')
    .slice(name.length + 1)
    .trim()
    .replace(/^(['"])(.*)\1$/, '$2')
}

/** Reads `NAME=value` lines; comment lines and unknown names are ignored. */
export function parseConfig(text: string): ProxyConfig {
  const lines = text.split(/\r?\n/).map((line) => line.trim())
  return {
    apiKey: configValue(lines, KEY_NAME),
    model: configValue(lines, MODEL_NAME)
  }
}

function corsHeaders(origin: string | undefined): Record<string, string> {
  return origin === PREVIEW_ORIGIN
    ? { 'access-control-allow-origin': PREVIEW_ORIGIN, vary: 'origin' }
    : {}
}

function json(
  status: number,
  body: unknown,
  origin: string | undefined
): ProxyReply {
  return {
    status,
    headers: { 'content-type': 'application/json', ...corsHeaders(origin) },
    body: JSON.stringify(body)
  }
}

function refusal(
  status: number,
  code: string,
  message: string,
  origin: string | undefined
): ProxyReply {
  return json(status, { error: { code, message } }, origin)
}

function missingConfig(config: ProxyConfig): string | null {
  if (!config.apiKey) return `${KEY_NAME} is empty in the proxy's config file.`
  if (!config.model) return `${MODEL_NAME} is empty in the proxy's config file.`
  return null
}

async function forward(
  request: ProxyRequest,
  { config, fetch: send, signal }: ProxyDeps
): Promise<ProxyReply> {
  const { origin } = request
  if (request.body.length > MAX_BODY_BYTES)
    return refusal(413, 'too_large', 'The request is too large.', origin)
  let posted: unknown
  try {
    posted = JSON.parse(request.body)
  } catch {
    return refusal(400, 'bad_request', 'The request is not JSON.', origin)
  }
  const chat = chatBodySchema.safeParse(posted)
  if (!chat.success)
    return refusal(400, 'bad_request', 'The request is not a chat.', origin)
  try {
    const upstream = await send(UPSTREAM_URL, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${config.apiKey}`,
        'content-type': 'application/json',
        'x-title': 'Comfy point-at-it POC'
      },
      body: JSON.stringify({
        ...chat.data,
        model: config.model,
        stream: true,
        provider: { require_parameters: true }
      }),
      signal
    })
    if (upstream.ok && upstream.body)
      return {
        status: 200,
        headers: {
          'content-type': 'text/event-stream',
          'cache-control': 'no-cache',
          ...corsHeaders(origin)
        },
        body: upstream.body
      }
    const text = (await upstream.text()).replaceAll(config.apiKey, '[key]')
    return {
      status: upstream.status,
      headers: { 'content-type': 'application/json', ...corsHeaders(origin) },
      body: text
    }
  } catch {
    return refusal(
      502,
      'upstream_unreachable',
      'The proxy could not reach OpenRouter.',
      origin
    )
  }
}

/**
 * The whole proxy as a function: `GET /health` and `POST /chat`, for the
 * preview's origin only. It adds the key and the model and nothing else.
 */
export async function handleProxyRequest(
  request: ProxyRequest,
  deps: ProxyDeps
): Promise<ProxyReply> {
  const { method, path, origin } = request
  if (method === 'GET' && path === '/health')
    return json(
      200,
      { keySet: Boolean(deps.config.apiKey), model: deps.config.model },
      origin
    )
  if (path !== '/chat')
    return refusal(404, 'not_found', 'Unknown path.', origin)
  if (origin !== PREVIEW_ORIGIN)
    return refusal(403, 'origin_not_allowed', 'Unknown origin.', origin)
  if (method === 'OPTIONS')
    return {
      status: 204,
      headers: {
        ...corsHeaders(origin),
        'access-control-allow-methods': 'POST',
        'access-control-allow-headers': 'content-type',
        'access-control-max-age': '600'
      },
      body: ''
    }
  if (method !== 'POST')
    return refusal(405, 'method_not_allowed', 'Use POST.', origin)
  const missing = missingConfig(deps.config)
  if (missing) return refusal(503, 'no_key', missing, origin)
  return forward(request, deps)
}
