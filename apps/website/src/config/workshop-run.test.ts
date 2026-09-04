import { describe, expect, it, vi } from 'vitest'

import { COMFY_ROUTER_BASE_URL, runRouterModel } from './workshop-run'

function respond(
  status: number,
  body: unknown,
  headers: Record<string, string> = {}
): typeof fetch {
  return vi.fn(async () =>
    Promise.resolve(
      new Response(typeof body === 'string' ? body : JSON.stringify(body), {
        status,
        headers: { 'Content-Type': 'application/json', ...headers }
      })
    )
  ) as unknown as typeof fetch
}

const options = { credentials: 'comfyui-test-key' }

describe('runRouterModel', () => {
  it('posts the input to the model id and returns the native output', async () => {
    const fetchImpl = respond(
      200,
      { images: [{ url: 'https://storage.comfy.org/a.png' }] },
      { 'X-Comfy-Request-Id': 'req-1' }
    )

    const result = await runRouterModel(
      'bfl/flux-2-pro',
      { prompt: 'a cat' },
      { ...options, fetchImpl }
    )

    expect(result).toEqual({
      status: 'ok',
      output: { images: [{ url: 'https://storage.comfy.org/a.png' }] },
      requestId: 'req-1'
    })

    const [url, init] = vi.mocked(fetchImpl).mock.calls[0] as [
      string,
      RequestInit
    ]
    expect(url).toBe(`${COMFY_ROUTER_BASE_URL}/v2/models/bfl/flux-2-pro`)
    expect(init.method).toBe('POST')
    expect(init.body).toBe('{"prompt":"a cat"}')
    // Router takes an API key and a Firebase JWT in the same bearer slot.
    expect((init.headers as Record<string, string>).Authorization).toBe(
      'Bearer comfyui-test-key'
    )
  })

  it('sends an idempotency key so a resend cannot bill twice', async () => {
    const fetchImpl = respond(200, {})
    await runRouterModel('p/m', {}, { ...options, fetchImpl })

    const [, init] = vi.mocked(fetchImpl).mock.calls[0] as [string, RequestInit]
    expect((init.headers as Record<string, string>)['Idempotency-Key']).toMatch(
      /^[0-9a-f-]{36}$/
    )
  })

  it('mints a fresh key per run, so pressing Run again really runs again', async () => {
    const fetchImpl = respond(200, {})
    await runRouterModel('p/m', {}, { ...options, fetchImpl })
    await runRouterModel('p/m', {}, { ...options, fetchImpl })

    const keys = vi
      .mocked(fetchImpl)
      .mock.calls.map(
        ([, init]) =>
          ((init as RequestInit).headers as Record<string, string>)[
            'Idempotency-Key'
          ]
      )
    expect(keys[0]).not.toBe(keys[1])
  })

  it('reports the error bucket from the header', async () => {
    const fetchImpl = respond(
      402,
      { detail: 'Balance is 0 credits.', error_type: 'insufficient_credits' },
      { 'X-Comfy-Error-Type': 'insufficient_credits' }
    )

    expect(
      await runRouterModel('p/m', {}, { ...options, fetchImpl })
    ).toMatchObject({
      status: 'error',
      errorType: 'insufficient_credits',
      detail: 'Balance is 0 credits.'
    })
  })

  it('falls back to the status when nothing names a bucket', async () => {
    // An edge or proxy answering instead of Router: echo's own shape, no
    // error_type anywhere.
    const fetchImpl = respond(401, { message: 'No Authorization header found' })

    expect(
      await runRouterModel('p/m', {}, { ...options, fetchImpl })
    ).toMatchObject({
      status: 'error',
      errorType: 'unauthorized',
      detail: 'No Authorization header found'
    })
  })

  it('keeps per-field granularity on a validation failure', async () => {
    const fetchImpl = respond(
      422,
      {
        detail: [
          { loc: ['body', 'prompt'], msg: 'field required' },
          { loc: ['body', 'seed'], msg: 'must be an integer' }
        ]
      },
      { 'X-Comfy-Error-Type': 'invalid_input' }
    )

    expect(
      await runRouterModel('p/m', {}, { ...options, fetchImpl })
    ).toMatchObject({
      errorType: 'invalid_input',
      detail: 'prompt: field required\nseed: must be an integer'
    })
  })

  it('survives a body that is not JSON at all', async () => {
    const fetchImpl = respond(502, '<html>bad gateway</html>')

    expect(
      await runRouterModel('p/m', {}, { ...options, fetchImpl })
    ).toMatchObject({
      status: 'error',
      errorType: 'service_unavailable',
      detail: '<html>bad gateway</html>'
    })
  })

  it('reports a failed request instead of throwing', async () => {
    const fetchImpl = vi.fn(async () =>
      Promise.reject(new TypeError('Failed to fetch'))
    ) as unknown as typeof fetch

    expect(
      await runRouterModel('p/m', {}, { ...options, fetchImpl })
    ).toMatchObject({ status: 'error', errorType: 'network_error' })
  })

  it('distinguishes a cancelled run from a network failure', async () => {
    const fetchImpl = vi.fn(async () =>
      Promise.reject(new DOMException('aborted', 'AbortError'))
    ) as unknown as typeof fetch

    expect(
      await runRouterModel('p/m', {}, { ...options, fetchImpl })
    ).toMatchObject({ status: 'error', errorType: 'client_disconnected' })
  })
})
