import { describe, expect, it } from 'vitest'

import {
  LOCAL_OAUTH_MESSAGE_TYPE,
  buildAuthorizeUrl,
  createPendingAuthorization,
  randomToken,
  s256Challenge,
  supportsBrowserSignIn,
  validateCallback
} from './pkce'

describe('PKCE', () => {
  it('derives the RFC 7636 appendix B S256 challenge', async () => {
    await expect(
      s256Challenge('dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk')
    ).resolves.toBe('E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM')
  })

  it('generates unpadded base64url verifiers within the RFC length bounds', () => {
    const tokens = new Set(Array.from({ length: 20 }, () => randomToken(32)))
    expect(tokens.size).toBe(20)
    for (const token of tokens) {
      expect(token).toMatch(/^[A-Za-z0-9_-]{43}$/)
    }
  })

  it('builds the authorize URL for the comfyui-local client', async () => {
    const pending = createPendingAuthorization('http://127.0.0.1:8188')
    const url = new URL(
      await buildAuthorizeUrl('https://cloud.comfy.org', pending)
    )

    expect(url.origin + url.pathname).toBe(
      'https://cloud.comfy.org/oauth/authorize'
    )
    expect(Object.fromEntries(url.searchParams)).toEqual({
      response_type: 'code',
      client_id: 'comfyui-local',
      redirect_uri: 'http://127.0.0.1:8188/comfy-oauth-callback.html',
      state: pending.state,
      code_challenge: await s256Challenge(pending.verifier),
      code_challenge_method: 'S256',
      resource: 'https://cloud.comfy.org/api'
    })
    expect(url.searchParams.has('code_verifier')).toBe(false)
  })
})

describe('validateCallback', () => {
  const state = 'expected-state'
  const message = (fields: Record<string, unknown>) => ({
    type: LOCAL_OAUTH_MESSAGE_TYPE,
    ...fields
  })

  it.for([
    { name: 'non-object', input: 'code=x', reason: 'ignored' },
    {
      name: 'foreign message',
      input: { type: 'other', state },
      reason: 'ignored'
    },
    {
      name: 'wrong state',
      input: message({ state: 'forged', code: 'c' }),
      reason: 'state_mismatch'
    },
    {
      name: 'missing state',
      input: message({ code: 'c' }),
      reason: 'state_mismatch'
    },
    {
      name: 'provider error',
      input: message({ state, error: 'access_denied' }),
      reason: 'denied'
    },
    { name: 'missing code', input: message({ state }), reason: 'denied' }
  ] as const)('refuses a $name', ({ input, reason }) => {
    expect(validateCallback(input, state)).toEqual({ ok: false, reason })
  })

  it('accepts a matching state with a code', () => {
    expect(validateCallback(message({ state, code: 'abc' }), state)).toEqual({
      ok: true,
      code: 'abc'
    })
  })
})

describe('supportsBrowserSignIn', () => {
  it.for([
    ['http://127.0.0.1:8188/', true],
    ['http://localhost:8000/', true],
    ['http://[::1]:8188/', false],
    ['http://192.168.1.5:8188/', false],
    ['https://127.0.0.1:8188/', false],
    ['https://cloud.comfy.org/', false]
  ] as const)('%s -> %s', ([href, expected]) => {
    expect(supportsBrowserSignIn(new URL(href))).toBe(expected)
  })
})
