import { afterEach, describe, expect, it, vi } from 'vitest'

import { useFeatureFlags } from '@/composables/useFeatureFlags'
import {
  desktopHostUser,
  isDesktopHostSessionActive,
  stopDesktopHostSession
} from '@/platform/auth/desktopHost/desktopHostSession'
import type { LocalWebAuthEnvironment } from '@/platform/auth/localWeb/localWebAuthBridge'
import { createMemoryTokenStore } from '@/platform/auth/localWeb/localWebTokenStore'
import { startLocalWebSession } from '@/platform/auth/localWeb/localWebSession'
import { reportError } from '@/platform/telemetry/reportError'

vi.mock(import('@/composables/useFeatureFlags'))
vi.mock(import('@/platform/telemetry/reportError'))

const ACCESS_TOKEN = `e30.${btoa(
  JSON.stringify({ sub: 'user-1', workspace_id: 'ws-1' })
)
  .replace(/\+/g, '-')
  .replace(/\//g, '_')
  .replace(/=+$/, '')}.sig`

function environment(pageUrl: string) {
  const page = { url: pageUrl }
  const items = new Map<string, string>([
    [
      'Comfy.LocalWebSignIn.Pending',
      JSON.stringify({ verifier: 'verifier-1', state: 'state-1' })
    ]
  ])
  const env = {
    issuer: 'https://cloud.example.test',
    pageUrl: () => page.url,
    navigate: vi.fn<(url: string) => void>(),
    replaceUrl: vi.fn((url: string) => {
      page.url = url
    }),
    sessionStorage: {
      getItem: (key: string) => items.get(key) ?? null,
      setItem: (key: string, value: string) => void items.set(key, value),
      removeItem: (key: string) => void items.delete(key)
    },
    tokens: createMemoryTokenStore(),
    fetchImpl: vi.fn<typeof fetch>(
      async () =>
        new Response(
          JSON.stringify({
            access_token: ACCESS_TOKEN,
            expires_in: 3600,
            refresh_token: 'refresh-1',
            scope: 'comfy-cloud:user:read',
            token_type: 'Bearer'
          }),
          { status: 200 }
        )
    ),
    now: () => Date.now()
  } satisfies LocalWebAuthEnvironment
  return { env, page }
}

afterEach(() => stopDesktopHostSession())

describe('startLocalWebSession', () => {
  it('changes nothing while local_web_sso is off', async () => {
    const { env, page } = environment(
      'http://127.0.0.1:8188/?code=code-1&state=state-1'
    )

    await expect(startLocalWebSession(env)).resolves.toBe(false)

    expect(isDesktopHostSessionActive()).toBe(false)
    expect(page.url).toBe('http://127.0.0.1:8188/?code=code-1&state=state-1')
    expect(env.fetchImpl).not.toHaveBeenCalled()
  })

  it.for([
    { host: 'a LAN address', url: 'http://192.168.1.20:8188/' },
    {
      host: 'IPv6 loopback, which has no token CORS',
      url: 'http://[::1]:8188/'
    }
  ])('does not start on $host', async ({ url }) => {
    vi.mocked(useFeatureFlags().flags).localWebSsoEnabled = true
    const { env } = environment(url)

    await expect(startLocalWebSession(env)).resolves.toBe(false)

    expect(isDesktopHostSessionActive()).toBe(false)
  })

  it('finishes the returned sign-in before consumers read the session', async () => {
    vi.mocked(useFeatureFlags().flags).localWebSsoEnabled = true
    const { env, page } = environment(
      'http://localhost:8188/?code=code-1&state=state-1'
    )

    await expect(startLocalWebSession(env)).resolves.toBe(true)

    expect(desktopHostUser.value).toEqual({
      id: 'user-1',
      email: undefined,
      workspaceId: 'ws-1'
    })
    expect(page.url).toBe('http://localhost:8188/')
  })

  it('starts signed out and reports a failed exchange', async () => {
    vi.mocked(useFeatureFlags().flags).localWebSsoEnabled = true
    const { env } = environment(
      'http://127.0.0.1:8188/?code=code-1&state=state-1'
    )
    env.fetchImpl.mockImplementation(
      async () =>
        new Response(JSON.stringify({ error: 'invalid_grant' }), {
          status: 400
        })
    )

    await startLocalWebSession(env)

    expect(isDesktopHostSessionActive()).toBe(true)
    expect(desktopHostUser.value).toBeNull()
    expect(reportError).toHaveBeenCalledWith(
      expect.any(Error),
      expect.objectContaining({
        errorType: 'local_web_sign_in_failed',
        surface: 'auth'
      })
    )
  })

  it('does not report a consent the person declined', async () => {
    vi.mocked(useFeatureFlags().flags).localWebSsoEnabled = true
    const { env } = environment(
      'http://127.0.0.1:8188/?error=access_denied&state=state-1'
    )

    await startLocalWebSession(env)

    expect(reportError).not.toHaveBeenCalled()
  })
})
