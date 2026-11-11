import { describe, expect, it, vi } from 'vitest'

import { pointConfig } from './core/config'
import { textToImageNodes } from './core/fakePointHost'
import { buildChatBody } from './core/modelPrompt'
import { handleProxyRequest, parseConfig, PREVIEW_ORIGIN } from './modelProxy'
import type { ProxyRequest } from './modelProxy'

const SECRET = 'sk-or-test-not-a-real-key'
const config = { apiKey: SECRET, model: 'anthropic/claude-sonnet-5.5' }
const chat = buildChatBody(
  { kind: 'batch', requestId: 'request-1', annotations: [], history: [] },
  textToImageNodes(),
  pointConfig.model
)

function post(overrides: Partial<ProxyRequest> = {}): ProxyRequest {
  return {
    method: 'POST',
    path: '/chat',
    origin: PREVIEW_ORIGIN,
    body: JSON.stringify(chat),
    ...overrides
  }
}

function upstreamAnswering(response: Response) {
  return vi.fn<typeof fetch>().mockResolvedValue(response)
}

async function text(
  body: string | ReadableStream<Uint8Array>
): Promise<string> {
  return typeof body === 'string' ? body : new Response(body).text()
}

describe('parseConfig', () => {
  it('reads the key and the model, ignoring comments, spaces and quotes', () => {
    expect(
      parseConfig(
        [
          '# OpenRouter',
          `OPENROUTER_API_KEY="${SECRET}"`,
          '  OPENROUTER_MODEL= anthropic/claude-sonnet-5.5  ',
          'OTHER=1'
        ].join('\n')
      )
    ).toEqual(config)
  })

  it('reads empty values as empty', () => {
    expect(parseConfig('OPENROUTER_API_KEY=\n')).toEqual({
      apiKey: '',
      model: ''
    })
  })
})

describe('handleProxyRequest', () => {
  it('L-12: adds the key and the model, asks for a stream, and passes the stream back to the preview', async () => {
    const upstream = upstreamAnswering(
      new Response('data: {"choices":[]}\n\n', {
        headers: { 'content-type': 'text/event-stream' }
      })
    )

    const reply = await handleProxyRequest(
      post({
        body: JSON.stringify({ ...chat, model: 'other/model', extra: 1 })
      }),
      { config, fetch: upstream }
    )

    const [url, init] = upstream.mock.calls[0]
    expect(url).toBe('https://openrouter.ai/api/v1/chat/completions')
    expect(new Headers(init?.headers).get('authorization')).toBe(
      `Bearer ${SECRET}`
    )
    expect(JSON.parse(String(init?.body))).toEqual({
      ...chat,
      model: 'anthropic/claude-sonnet-5.5',
      stream: true,
      provider: { require_parameters: true }
    })
    expect(reply.status).toBe(200)
    expect(reply.headers).toMatchObject({
      'content-type': 'text/event-stream',
      'access-control-allow-origin': PREVIEW_ORIGIN
    })
    expect(await text(reply.body)).toBe('data: {"choices":[]}\n\n')
  })

  it.for([
    { name: 'another site', origin: 'http://evil.example' },
    { name: 'no origin at all', origin: undefined }
  ])(
    'L-12: refuses a chat from $name without calling the model',
    async ({ origin }) => {
      const upstream = upstreamAnswering(new Response(''))

      const reply = await handleProxyRequest(post({ origin }), {
        config,
        fetch: upstream
      })

      expect(reply.status).toBe(403)
      expect(reply.headers).not.toHaveProperty('access-control-allow-origin')
      expect(upstream).not.toHaveBeenCalled()
    }
  )

  it('L-12: answers only /health and /chat', async () => {
    const upstream = upstreamAnswering(new Response(''))
    const deps = { config, fetch: upstream }

    const health = await handleProxyRequest(
      post({ method: 'GET', path: '/health', origin: undefined }),
      deps
    )
    const other = await handleProxyRequest(post({ path: '/v1/models' }), deps)

    expect(JSON.parse(await text(health.body))).toEqual({
      keySet: true,
      model: 'anthropic/claude-sonnet-5.5'
    })
    expect(other.status).toBe(404)
    expect(upstream).not.toHaveBeenCalled()
  })

  it('answers the browser’s preflight for the preview', async () => {
    const reply = await handleProxyRequest(
      post({ method: 'OPTIONS', body: '' }),
      {
        config,
        fetch: upstreamAnswering(new Response(''))
      }
    )

    expect(reply).toMatchObject({
      status: 204,
      headers: {
        'access-control-allow-origin': PREVIEW_ORIGIN,
        'access-control-allow-methods': 'POST',
        'access-control-allow-headers': 'content-type'
      }
    })
  })

  it.for([
    {
      name: 'the key',
      config: { ...config, apiKey: '' },
      names: 'OPENROUTER_API_KEY'
    },
    {
      name: 'the model',
      config: { ...config, model: '' },
      names: 'OPENROUTER_MODEL'
    }
  ])(
    'L-10: says which value is missing when $name is empty',
    async ({ config: missing, names }) => {
      const upstream = upstreamAnswering(new Response(''))

      const reply = await handleProxyRequest(post(), {
        config: missing,
        fetch: upstream
      })

      expect(reply.status).toBe(503)
      expect(JSON.parse(await text(reply.body))).toMatchObject({
        error: { code: 'no_key', message: expect.stringContaining(names) }
      })
      expect(upstream).not.toHaveBeenCalled()
    }
  )

  it.for([
    { name: 'not JSON', body: 'hello' },
    { name: 'not a chat', body: '{"messages":[]}' }
  ])('refuses a body that is $name', async ({ body }) => {
    const upstream = upstreamAnswering(new Response(''))

    const reply = await handleProxyRequest(post({ body }), {
      config,
      fetch: upstream
    })

    expect(reply.status).toBe(400)
    expect(upstream).not.toHaveBeenCalled()
  })

  it('L-05: passes a provider error on with its status, and never the key', async () => {
    const upstream = upstreamAnswering(
      Response.json(
        { error: { code: 401, message: `Bad key ${SECRET}` } },
        { status: 401 }
      )
    )

    const reply = await handleProxyRequest(post(), { config, fetch: upstream })

    expect(reply.status).toBe(401)
    expect(await text(reply.body)).toBe(
      '{"error":{"code":401,"message":"Bad key [key]"}}'
    )
  })

  it('L-05: says so when OpenRouter cannot be reached', async () => {
    const upstream = vi
      .fn<typeof fetch>()
      .mockRejectedValue(new TypeError('fetch failed'))

    const reply = await handleProxyRequest(post(), { config, fetch: upstream })

    expect(reply.status).toBe(502)
    expect(JSON.parse(await text(reply.body))).toMatchObject({
      error: { code: 'upstream_unreachable' }
    })
  })
})
