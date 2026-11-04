import { beforeEach, describe, expect, it, vi } from 'vitest'

import { getComfyApiBaseUrl } from '@/config/comfyApi'
import type {
  RouterHeaders,
  RouterRequest
} from '@/renderer/extensions/superComfy/router/routerApi'
import {
  createRouterClient,
  parseRouterHeaders,
  routerModelPath
} from '@/renderer/extensions/superComfy/router/routerApi'
import { useAuthStore } from '@/stores/authStore'
import { stubFirebaseAuthHarness } from '@/utils/__tests__/stubAccountIdentityPort'

vi.mock(import('firebase/auth'), { spy: true })

const WORKSPACE = { Authorization: 'Bearer workspace' } as const
const FIREBASE = { Authorization: 'Bearer firebase' } as const
const LIST: RouterRequest = {
  path: '/v2/models?limit=1',
  method: 'GET',
  timeoutMs: 1000
}

function jsonResponse(
  status: number,
  body: unknown,
  headers: Record<string, string> = {}
): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...headers }
  })
}

function sentAuthorizations(): (string | null)[] {
  return vi
    .mocked(fetch)
    .mock.calls.map(([, init]) =>
      new Headers(init?.headers).get('Authorization')
    )
}

function answerByToken(workspace: () => Response, firebase: () => Response) {
  vi.mocked(fetch).mockImplementation(async (_input, init) =>
    new Headers(init?.headers).get('Authorization') === FIREBASE.Authorization
      ? firebase()
      : workspace()
  )
}

beforeEach(() => {
  stubFirebaseAuthHarness()
  vi.mocked(useAuthStore().getWorkspaceAuthHeader).mockResolvedValue(WORKSPACE)
  vi.mocked(useAuthStore().getFirebaseAuthHeader).mockResolvedValue(FIREBASE)
})

describe('createRouterClient', () => {
  it('sends to the Comfy API base with the workspace credential first', async () => {
    vi.mocked(fetch).mockResolvedValue(jsonResponse(200, { data: [] }))

    const response = await createRouterClient().fetch(LIST)

    expect(response).toMatchObject({
      ok: true,
      status: 200,
      json: { data: [] }
    })
    expect(vi.mocked(fetch).mock.calls[0]?.[0]).toBe(
      `${getComfyApiBaseUrl()}/v2/models?limit=1`
    )
    expect(sentAuthorizations()).toEqual(['Bearer workspace'])
  })

  it('falls back to Firebase on a 401 and tries Firebase first afterwards', async () => {
    answerByToken(
      () => jsonResponse(401, { detail: 'token audience' }),
      () => jsonResponse(200, { data: [] })
    )
    const client = createRouterClient()

    await client.fetch(LIST)
    await client.fetch(LIST)

    expect(sentAuthorizations()).toEqual([
      'Bearer workspace',
      'Bearer firebase',
      'Bearer firebase'
    ])
  })

  it.for([
    {
      name: 'a 401',
      response: () => jsonResponse(401, { detail: 'expired' }),
      fallsThrough: true
    },
    {
      name: 'a 403 marked unauthorized',
      response: () =>
        jsonResponse(
          403,
          { detail: 'nope' },
          { 'X-Comfy-Error-Type': 'unauthorized' }
        ),
      fallsThrough: true
    },
    {
      name: 'a 403 not_enabled',
      response: () =>
        jsonResponse(403, { detail: 'not here', error_type: 'not_enabled' }),
      fallsThrough: false
    },
    {
      name: 'a 402',
      response: () =>
        jsonResponse(402, {
          detail: 'No credits',
          error_type: 'payment_required'
        }),
      fallsThrough: false
    },
    {
      name: 'a 422',
      response: () => jsonResponse(422, { detail: 'bad prompt' }),
      fallsThrough: false
    }
  ])(
    '$name falls through to Firebase: $fallsThrough',
    async ({ response, fallsThrough }) => {
      answerByToken(response, () => jsonResponse(200, { data: [] }))

      const result = await createRouterClient().fetch(LIST)

      expect(result.ok).toBe(fallsThrough)
    }
  )

  it('reports unauthenticated with the last refusal when every credential is refused', async () => {
    answerByToken(
      () => jsonResponse(401, { detail: 'workspace refused' }),
      () => jsonResponse(401, { detail: 'firebase refused' })
    )

    expect(await createRouterClient().fetch(LIST)).toEqual({
      ok: false,
      reason: 'unauthenticated',
      detail: 'firebase refused'
    })
  })

  it('sends nothing when the user has no credential', async () => {
    vi.mocked(useAuthStore().getWorkspaceAuthHeader).mockResolvedValue(null)
    vi.mocked(useAuthStore().getFirebaseAuthHeader).mockResolvedValue(null)

    const result = await createRouterClient().fetch(LIST)

    expect(result).toEqual({ ok: false, reason: 'unauthenticated', detail: '' })
    expect(fetch).not.toHaveBeenCalled()
  })

  it('does not resend the same token when both credentials are equal', async () => {
    vi.mocked(useAuthStore().getWorkspaceAuthHeader).mockResolvedValue(FIREBASE)
    vi.mocked(fetch).mockResolvedValue(jsonResponse(401, { detail: 'refused' }))

    await createRouterClient().fetch(LIST)

    expect(fetch).toHaveBeenCalledTimes(1)
  })

  it('sends the API key header for an API-key session', async () => {
    vi.mocked(useAuthStore().getWorkspaceAuthHeader).mockResolvedValue({
      'X-API-KEY': 'key-123'
    })
    vi.mocked(fetch).mockResolvedValue(jsonResponse(200, {}))

    await createRouterClient().fetch(LIST)

    expect(
      new Headers(vi.mocked(fetch).mock.calls[0]?.[1]?.headers).get('X-API-KEY')
    ).toBe('key-123')
  })

  it.for([
    {
      name: 'a string detail with its error type',
      response: () =>
        jsonResponse(402, {
          detail: 'Insufficient credits',
          error_type: 'payment_required'
        }),
      expected: {
        status: 402,
        errorType: 'payment_required',
        detail: 'Insufficient credits'
      }
    },
    {
      name: 'validation errors as location and message',
      response: () =>
        jsonResponse(422, {
          detail: [
            { loc: ['body', 'prompt'], msg: 'field required' },
            { loc: ['body', 'n'], msg: 'too large' }
          ]
        }),
      expected: {
        status: 422,
        detail: 'prompt: field required; n: too large'
      }
    },
    {
      name: 'a plain text body',
      response: () =>
        new Response('upstream timed out', {
          status: 504,
          headers: { 'Content-Type': 'text/plain' }
        }),
      expected: { status: 504, detail: 'upstream timed out' }
    }
  ])('reads $name from a refusal', async ({ response, expected }) => {
    vi.mocked(fetch).mockResolvedValue(response())

    expect(await createRouterClient().fetch(LIST)).toMatchObject({
      ok: false,
      reason: 'refused',
      ...expected
    })
  })

  it('reports a network failure without trying another credential', async () => {
    vi.mocked(fetch).mockRejectedValue(new TypeError('Failed to fetch'))

    const result = await createRouterClient().fetch(LIST)

    expect(result).toEqual({
      ok: false,
      reason: 'network',
      message: 'Failed to fetch'
    })
    expect(fetch).toHaveBeenCalledTimes(1)
  })

  it('sends a JSON body with the idempotency key', async () => {
    vi.mocked(fetch).mockResolvedValue(jsonResponse(201, { request_id: 'r1' }))

    await createRouterClient().fetch({
      path: '/v2/models/bfl/flux-2-pro/requests',
      method: 'POST',
      body: { prompt: 'a fox' },
      idempotencyKey: 'key-1',
      timeoutMs: 1000
    })

    const init = vi.mocked(fetch).mock.calls[0]?.[1]
    expect(new Headers(init?.headers).get('Idempotency-Key')).toBe('key-1')
    expect(init?.body).toBe('{"prompt":"a fox"}')
  })
})

describe('parseRouterHeaders', () => {
  const now = Date.UTC(2026, 10, 4, 12, 0, 0)

  it.for<{
    name: string
    headers: Record<string, string>
    expected: Partial<RouterHeaders>
  }>([
    {
      name: 'Retry-After in seconds',
      headers: { 'Retry-After': '5' },
      expected: { retryAfterMs: 5000 }
    },
    {
      name: 'Retry-After as an HTTP date',
      headers: { 'Retry-After': new Date(now + 10_000).toUTCString() },
      expected: { retryAfterMs: 10_000 }
    },
    {
      name: 'Retry-After capped at a minute',
      headers: { 'Retry-After': '600' },
      expected: { retryAfterMs: 60_000 }
    },
    {
      name: 'credits, dropped params and replay',
      headers: {
        'X-Comfy-Credits-Used': '12.5',
        'X-Comfy-Router-Dropped-Params': 'seed,fps',
        'Idempotent-Replayed': 'true'
      },
      expected: {
        creditsUsed: 12.5,
        droppedParams: 'seed,fps',
        replayed: true
      }
    }
  ])('reads $name', ({ headers, expected }) => {
    expect(parseRouterHeaders(new Headers(headers), now)).toMatchObject(
      expected
    )
  })
})

describe('routerModelPath', () => {
  it.for([
    { id: 'bfl/flux-2-pro', expected: 'bfl/flux-2-pro' },
    { id: 'meshy/meshy-7.1', expected: 'meshy/meshy-7.1' },
    { id: 'acme/a/b c', expected: 'acme/a%2Fb%20c' }
  ])('encodes $id', ({ id, expected }) => {
    expect(routerModelPath(id)).toBe(expected)
  })
})
