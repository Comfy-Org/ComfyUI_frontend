import { beforeEach, describe, expect, it, vi } from 'vitest'

import {
  OAuthApiError,
  fetchOAuthConsentChallenge,
  submitOAuthConsentDecision
} from '@/platform/cloud/oauth/oauthApi'
import type { OAuthConsentChallenge } from '@/platform/cloud/oauth/oauthApi'

const validChallenge: OAuthConsentChallenge = {
  oauth_request_id: '550e8400-e29b-41d4-a716-446655440000',
  csrf_token: 'csrf-token',
  client_display_name: 'Cursor',
  scopes: ['mcp:tools:read'],
  workspaces: [
    {
      id: 'personal-workspace',
      name: 'Kishore',
      type: 'personal',
      role: 'owner'
    }
  ]
}

const okResponse = (body: unknown) =>
  new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'Content-Type': 'application/json' }
  })

const errorResponse = (status: number, message: string) =>
  new Response(JSON.stringify({ message }), {
    status,
    headers: { 'Content-Type': 'application/json' }
  })

describe('fetchOAuthConsentChallenge', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('returns the parsed challenge on 200', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(okResponse(validChallenge))

    const result = await fetchOAuthConsentChallenge(
      validChallenge.oauth_request_id
    )

    expect(result).toEqual(validChallenge)
  })

  it('URL-encodes the oauth_request_id', async () => {
    const fetchSpy = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(okResponse(validChallenge))

    // Reserved characters get percent-encoded (defense-in-depth — valid UUIDs
    // never contain these chars, but the call should be safe regardless).
    await fetchOAuthConsentChallenge('id with spaces&injected=evil')

    const url = fetchSpy.mock.calls[0]?.[0] as string
    expect(url).toContain(
      'oauth_request_id=id%20with%20spaces%26injected%3Devil'
    )
  })

  it('throws OAuthApiError with status on non-2xx', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      errorResponse(400, 'expired')
    )

    await expect(fetchOAuthConsentChallenge('abc')).rejects.toMatchObject({
      name: 'OAuthApiError',
      status: 400
    })
  })

  it('rejects when scopes are not strings', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      okResponse({ ...validChallenge, scopes: [123, 'mcp:tools:read'] })
    )

    await expect(fetchOAuthConsentChallenge('abc')).rejects.toThrow(
      'OAuth consent challenge is invalid'
    )
  })

  it('rejects when a workspace is missing required fields', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      okResponse({
        ...validChallenge,
        workspaces: [{ id: 'x', name: 'y', type: 'personal' }]
      })
    )

    await expect(fetchOAuthConsentChallenge('abc')).rejects.toThrow(
      'OAuth consent challenge is invalid'
    )
  })

  it('rejects when workspace.type is not personal or team', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      okResponse({
        ...validChallenge,
        workspaces: [{ id: 'x', name: 'y', type: 'enterprise', role: 'owner' }]
      })
    )

    await expect(fetchOAuthConsentChallenge('abc')).rejects.toThrow(
      'OAuth consent challenge is invalid'
    )
  })

  it('rejects when workspace.role is not owner or member', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      okResponse({
        ...validChallenge,
        workspaces: [{ id: 'x', name: 'y', type: 'team', role: 'admin' }]
      })
    )

    await expect(fetchOAuthConsentChallenge('abc')).rejects.toThrow(
      'OAuth consent challenge is invalid'
    )
  })

  it('rejects when top-level fields are missing', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      okResponse({ ...validChallenge, csrf_token: undefined })
    )

    await expect(fetchOAuthConsentChallenge('abc')).rejects.toThrow(
      'OAuth consent challenge is invalid'
    )
  })

  it('rejects null body', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(okResponse(null))

    await expect(fetchOAuthConsentChallenge('abc')).rejects.toThrow(
      'OAuth consent challenge is invalid'
    )
  })
})

describe('submitOAuthConsentDecision', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('navigates to the redirect_url returned by cloud on success', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      okResponse({ redirect_url: 'http://127.0.0.1:50632/cb?code=xyz' })
    )
    // jsdom location is not writable directly; replace href via spy.
    const originalLocation = globalThis.location
    const hrefSetter = vi.fn()
    Object.defineProperty(globalThis, 'location', {
      configurable: true,
      value: new Proxy(originalLocation, {
        set(_target, prop, value) {
          if (prop === 'href') {
            hrefSetter(value)
            return true
          }
          return Reflect.set(originalLocation, prop, value)
        },
        get(_target, prop) {
          return Reflect.get(originalLocation, prop)
        }
      })
    })

    try {
      await submitOAuthConsentDecision({
        oauthRequestId: validChallenge.oauth_request_id,
        csrfToken: validChallenge.csrf_token,
        decision: 'allow',
        workspaceId: 'personal-workspace'
      })

      expect(hrefSetter).toHaveBeenCalledWith(
        'http://127.0.0.1:50632/cb?code=xyz'
      )
    } finally {
      // Restore unconditionally so an assertion failure doesn't leak the
      // Proxy'd location into later tests.
      Object.defineProperty(globalThis, 'location', {
        configurable: true,
        value: originalLocation
      })
    }
  })

  it('throws OAuthApiError on non-2xx', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      errorResponse(403, 'scope broadening')
    )

    await expect(
      submitOAuthConsentDecision({
        oauthRequestId: validChallenge.oauth_request_id,
        csrfToken: validChallenge.csrf_token,
        decision: 'allow',
        workspaceId: 'personal-workspace'
      })
    ).rejects.toBeInstanceOf(OAuthApiError)
  })

  it('throws when redirect_url is missing from a successful response', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(okResponse({}))

    await expect(
      submitOAuthConsentDecision({
        oauthRequestId: validChallenge.oauth_request_id,
        csrfToken: validChallenge.csrf_token,
        decision: 'allow',
        workspaceId: 'personal-workspace'
      })
    ).rejects.toThrow('redirect_url')
  })

  it('navigates to a reverse-DNS custom-scheme redirect_url (native clients)', async () => {
    // RFC 8252 native-app callback — the comfy-ios client returns the
    // authorization code via org.comfy.ios://oauth-callback. The backend
    // has already validated the URL byte-identically against the client's
    // registered redirect_uris.
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      okResponse({
        redirect_url: 'org.comfy.ios://oauth-callback?code=xyz&state=s'
      })
    )
    const originalLocation = globalThis.location
    const hrefSetter = vi.fn()
    Object.defineProperty(globalThis, 'location', {
      configurable: true,
      value: new Proxy(originalLocation, {
        set(_target, prop, value) {
          if (prop === 'href') {
            hrefSetter(value)
            return true
          }
          return Reflect.set(originalLocation, prop, value)
        },
        get(_target, prop) {
          return Reflect.get(originalLocation, prop)
        }
      })
    })

    try {
      await submitOAuthConsentDecision({
        oauthRequestId: validChallenge.oauth_request_id,
        csrfToken: validChallenge.csrf_token,
        decision: 'allow',
        workspaceId: 'personal-workspace',
        expectedRedirectUri: 'org.comfy.ios://oauth-callback'
      })

      expect(hrefSetter).toHaveBeenCalledWith(
        'org.comfy.ios://oauth-callback?code=xyz&state=s'
      )
      expect(hrefSetter).toHaveBeenCalledTimes(1)
    } finally {
      Object.defineProperty(globalThis, 'location', {
        configurable: true,
        value: originalLocation
      })
    }
  })

  it.for([
    [
      'org.comfy.ios://oauth-callback?code=xyz',
      undefined,
      'unsafe scheme',
      'custom scheme with no expectedRedirectUri is unbindable, falls back to the http(s)-only rule'
    ],
    [
      'com.evil.app://oauth-callback?code=xyz',
      'org.comfy.ios://oauth-callback',
      'does not match',
      'bound challenge, different scheme: wrong-client redirect'
    ],
    [
      'org.comfy.ios://oauth-callback/../steal?code=xyz',
      'org.comfy.ios://oauth-callback',
      'does not match',
      'bound challenge, same scheme but different path'
    ],
    [
      'javascript:alert(1)',
      'javascript:alert(1)',
      'unsafe scheme',
      'executable schemes are rejected even if the challenge claims them'
    ],
    [
      'data:text/html,<script>alert(1)</script>',
      'data:text/html,x',
      'unsafe scheme',
      'data: scheme rejected even if the challenge claims it'
    ],
    [
      'blob:https://cloud.comfy.org/abc',
      undefined,
      'unsafe scheme',
      'blob: scheme is unsafe'
    ]
  ] as const)(
    'rejects redirect_url %s (registration %s, expects %s): %s',
    async ([redirectUrl, expectedRedirectUri, expectedError]) => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValue(
        okResponse({ redirect_url: redirectUrl })
      )

      await expect(
        submitOAuthConsentDecision({
          oauthRequestId: validChallenge.oauth_request_id,
          csrfToken: validChallenge.csrf_token,
          decision: 'allow',
          workspaceId: 'personal-workspace',
          expectedRedirectUri
        })
      ).rejects.toThrow(expectedError)
    }
  )

  it('rejects an unsafe redirect_url scheme', async () => {
    // Defense in depth: even though the cloud backend is trusted, never
    // hand the browser off to a non-http(s) URL.
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      okResponse({ redirect_url: 'javascript:alert(1)' })
    )

    await expect(
      submitOAuthConsentDecision({
        oauthRequestId: validChallenge.oauth_request_id,
        csrfToken: validChallenge.csrf_token,
        decision: 'allow',
        workspaceId: 'personal-workspace'
      })
    ).rejects.toThrow('unsafe scheme')
  })

  it('sends the expected JSON body', async () => {
    const fetchSpy = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(okResponse({ redirect_url: 'http://x.test/' }))

    await submitOAuthConsentDecision({
      oauthRequestId: validChallenge.oauth_request_id,
      csrfToken: validChallenge.csrf_token,
      decision: 'deny',
      workspaceId: 'personal-workspace'
    })

    const init = fetchSpy.mock.calls[0]?.[1] as RequestInit
    expect(JSON.parse(init.body as string)).toEqual({
      oauth_request_id: validChallenge.oauth_request_id,
      csrf_token: validChallenge.csrf_token,
      decision: 'deny',
      workspace_id: 'personal-workspace'
    })
  })
})
