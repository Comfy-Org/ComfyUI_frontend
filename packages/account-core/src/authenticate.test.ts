import { describe, expect, it, vi } from 'vitest'

import type { PasswordSignIn } from './authenticate'
import { authenticateWithPassword } from './authenticate'

const ORIGIN = 'https://cloud.comfy.org'

const jsonResponse = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' }
  })

describe('authenticateWithPassword', () => {
  it('posts the trimmed email and the password with credentials', async () => {
    const fetchImpl = vi.fn<typeof fetch>(async () =>
      jsonResponse(200, { method: 'session', expires_in: 60 })
    )

    await authenticateWithPassword(' a@corp.example ', 'pw', {
      fetchImpl,
      baseUrl: ORIGIN
    })

    expect(fetchImpl).toHaveBeenCalledWith(
      `${ORIGIN}/api/auth/authenticate`,
      expect.objectContaining({
        method: 'POST',
        credentials: 'include',
        body: JSON.stringify({ email: 'a@corp.example', password: 'pw' })
      })
    )
  })

  it.for<[string, Response, PasswordSignIn]>([
    [
      'a session',
      jsonResponse(200, { method: 'session' }),
      { kind: 'session' }
    ],
    [
      'an account still on Firebase',
      jsonResponse(200, { method: 'firebase' }),
      { kind: 'firebase' }
    ],
    [
      'an SSO refusal',
      jsonResponse(403, {
        code: 'sso_required',
        message: 'x',
        start_url: '/s'
      }),
      { kind: 'sso-required' }
    ],
    [
      'another 403',
      jsonResponse(403, { code: 'origin_not_allowed', message: 'x' }),
      { kind: 'unavailable' }
    ],
    [
      'wrong credentials',
      jsonResponse(401, { code: 'INVALID_CREDENTIALS', message: 'x' }),
      { kind: 'invalid-credentials' }
    ],
    [
      'too many attempts',
      jsonResponse(429, { code: 'RATE_LIMITED', message: 'x' }),
      { kind: 'rate-limited' }
    ],
    [
      'a 502',
      jsonResponse(502, { code: 'SIGN_IN_UNAVAILABLE', message: 'x' }),
      { kind: 'unavailable' }
    ],
    [
      'an unreadable body',
      new Response('nope', { status: 200 }),
      { kind: 'unavailable' }
    ]
  ])('maps %s', async ([, response, expected]) => {
    const fetchImpl = vi.fn<typeof fetch>(async () => response)
    await expect(
      authenticateWithPassword('a@corp.example', 'pw', { fetchImpl })
    ).resolves.toEqual(expected)
  })

  it('is unavailable when the request fails', async () => {
    const fetchImpl = vi.fn<typeof fetch>(async () => {
      throw new TypeError('network')
    })
    await expect(
      authenticateWithPassword('a@corp.example', 'pw', { fetchImpl })
    ).resolves.toEqual({ kind: 'unavailable' })
  })
})
