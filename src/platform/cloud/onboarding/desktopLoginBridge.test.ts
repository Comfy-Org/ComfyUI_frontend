import { beforeEach, describe, expect, it, vi } from 'vitest'

import {
  completeDesktopLoginIfNeeded,
  getDesktopLoginRequest,
  hasDesktopLoginRequest
} from './desktopLoginBridge'

const hoisted = vi.hoisted(() => ({
  identifyPostHogUser: vi.fn()
}))

vi.mock('@/platform/telemetry/providers/cloud/posthogIdentity', () => ({
  identifyPostHogUser: hoisted.identifyPostHogUser
}))

vi.mock('@/config/firebase', () => ({
  getFirebaseConfig: () => ({ apiKey: 'firebase-api-key' })
}))

describe('desktopLoginBridge', () => {
  beforeEach(() => {
    hoisted.identifyPostHogUser.mockClear()
    vi.unstubAllGlobals()
  })

  it('accepts localhost callback requests with state', () => {
    const query = {
      desktop_login_callback: 'http://localhost:9876/callback',
      desktop_login_state: 'state-123'
    }

    expect(hasDesktopLoginRequest(query)).toBe(true)
    expect(getDesktopLoginRequest(query)).toMatchObject({
      callbackUrl: new URL('http://localhost:9876/callback'),
      state: 'state-123'
    })
  })

  it('rejects non-loopback callback requests', () => {
    expect(
      hasDesktopLoginRequest({
        desktop_login_callback: 'https://evil.example/callback',
        desktop_login_state: 'state-123'
      })
    ).toBe(false)
  })

  it('rejects callback requests without the Desktop callback port', () => {
    expect(
      hasDesktopLoginRequest({
        desktop_login_callback: 'http://localhost:1234/callback',
        desktop_login_state: 'state-123'
      })
    ).toBe(false)
    expect(
      hasDesktopLoginRequest({
        desktop_login_callback: 'http://localhost/callback',
        desktop_login_state: 'state-123'
      })
    ).toBe(false)
  })

  it('identifies the browser PostHog user and posts Firebase user payload to Desktop', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 204 })
    vi.stubGlobal('fetch', fetchMock)

    const completed = await completeDesktopLoginIfNeeded(
      {
        desktop_login_callback: 'http://localhost:9876/callback',
        desktop_login_state: 'state-123'
      },
      {
        uid: 'user-123',
        toJSON: () => ({ uid: 'user-123', email: 'person@example.com' })
      } as never
    )

    expect(completed).toBe(true)
    expect(hoisted.identifyPostHogUser).toHaveBeenCalledWith('user-123')
    expect(fetchMock).toHaveBeenCalledWith(
      'http://localhost:9876/callback',
      expect.objectContaining({
        method: 'POST',
        mode: 'cors',
        credentials: 'omit',
        body: JSON.stringify({
          state: 'state-123',
          apiKey: 'firebase-api-key',
          user: { uid: 'user-123', email: 'person@example.com' }
        })
      })
    )
  })
})
