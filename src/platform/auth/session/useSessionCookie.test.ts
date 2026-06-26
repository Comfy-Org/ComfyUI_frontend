import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mockGetIdToken = vi.fn()
const originalFetch = globalThis.fetch

vi.mock('@/platform/distribution/types', () => ({
  isCloud: true
}))

vi.mock('@/composables/useFeatureFlags', () => ({
  useFeatureFlags: () => ({
    flags: {
      teamWorkspacesEnabled: true
    }
  })
}))

vi.mock('@/stores/authStore', () => ({
  useAuthStore: () => ({
    getIdToken: mockGetIdToken,
    getAuthHeader: vi.fn()
  })
}))

vi.mock('@/scripts/api', () => ({
  api: {
    apiURL: (path: string) => `/api${path}`
  }
}))

describe('useSessionCookie', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.restoreAllMocks()
    mockGetIdToken.mockReset()
    globalThis.fetch = vi.fn()
  })

  afterEach(() => {
    // Restore the global fetch so a leaked mock doesn't bleed into later
    // tests that depend on real fetch semantics.
    globalThis.fetch = originalFetch
  })

  it('createSessionOrThrow posts the Firebase token and awaits success', async () => {
    mockGetIdToken.mockResolvedValue('firebase-id-token')
    vi.mocked(globalThis.fetch).mockResolvedValue(
      new Response(null, { status: 204 })
    )
    const { useSessionCookie } =
      await import('@/platform/auth/session/useSessionCookie')

    await useSessionCookie().createSessionOrThrow()

    expect(globalThis.fetch).toHaveBeenCalledWith('/api/auth/session', {
      method: 'POST',
      credentials: 'include',
      headers: {
        Authorization: 'Bearer firebase-id-token',
        'Content-Type': 'application/json'
      }
    })
  })

  it('createSessionOrThrow fails fast without a Firebase token', async () => {
    mockGetIdToken.mockResolvedValue(null)
    const { useSessionCookie } =
      await import('@/platform/auth/session/useSessionCookie')

    await expect(useSessionCookie().createSessionOrThrow()).rejects.toThrow(
      'No Firebase token available for session creation'
    )
    expect(globalThis.fetch).not.toHaveBeenCalled()
  })

  it('createSessionOrThrow fails fast on non-success responses', async () => {
    mockGetIdToken.mockResolvedValue('firebase-id-token')
    vi.mocked(globalThis.fetch).mockResolvedValue(
      new Response(JSON.stringify({ message: 'session denied' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      })
    )
    const { useSessionCookie } =
      await import('@/platform/auth/session/useSessionCookie')

    await expect(useSessionCookie().createSessionOrThrow()).rejects.toThrow(
      'session denied'
    )
  })
})
