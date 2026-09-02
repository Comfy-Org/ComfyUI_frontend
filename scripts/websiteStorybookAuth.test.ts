// @vitest-environment node

import { describe, expect, it, vi } from 'vitest'

import { GET, POST } from "@comfyorg/website-storybook-mcp/api/auth.js"

function cookieHeader(response: Response): string {
  return response.headers.get('set-cookie')?.split(';', 1)[0] ?? ''
}

describe('Storybook OAuth', () => {
  it('uses the canonical callback for preview deployments', async () => {
    vi.stubEnv('AUTH_GOOGLE_ID', 'google-client-id')
    vi.stubEnv('AUTH_GOOGLE_SECRET', 'google-client-secret')
    vi.stubEnv('AUTH_SECRET', 'test-secret')
    vi.stubGlobal(
      'fetch',
      vi.fn<typeof fetch>(async () =>
        Response.json({
          authorization_endpoint:
            'https://accounts.google.com/o/oauth2/v2/auth',
          issuer: 'https://accounts.google.com',
          jwks_uri: 'https://www.googleapis.com/oauth2/v3/certs',
          token_endpoint: 'https://oauth2.googleapis.com/token',
          userinfo_endpoint: 'https://openidconnect.googleapis.com/v1/userinfo'
        })
      )
    )

    const csrfResponse = await GET(
      new Request('https://preview.vercel.app/api/auth?path=csrf')
    )
    const { csrfToken } = (await csrfResponse.json()) as {
      csrfToken: string
    }
    const signInResponse = await POST(
      new Request('https://preview.vercel.app/api/auth?path=signin%2Fgoogle', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          Cookie: cookieHeader(csrfResponse)
        },
        body: new URLSearchParams({
          callbackUrl: 'https://preview.vercel.app/',
          csrfToken
        })
      })
    )

    const authorizationUrl = new URL(
      signInResponse.headers.get('Location') ?? ''
    )

    expect(authorizationUrl.searchParams.get('redirect_uri')).toBe(
      'https://comfy-website-storybook-mcp.vercel.app/api/auth/callback/google'
    )
  })
})
