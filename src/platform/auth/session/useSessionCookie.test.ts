import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mockGetIdToken = vi.fn()
const mockAuthState = vi.hoisted(() => ({
  currentUser: { uid: 'user-a' } as { uid: string } | null
}))
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
    getAuthHeader: vi.fn(),
    get currentUser() {
      return mockAuthState.currentUser
    }
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
    mockAuthState.currentUser = { uid: 'user-a' }
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

  it('createSession coalesces concurrent callers into one POST', async () => {
    mockGetIdToken.mockResolvedValue('firebase-id-token')
    let resolveFetch: (value: Response) => void = () => {}
    vi.mocked(globalThis.fetch).mockReturnValue(
      new Promise<Response>((resolve) => {
        resolveFetch = resolve
      })
    )
    const { useSessionCookie } =
      await import('@/platform/auth/session/useSessionCookie')

    const { createSession } = useSessionCookie()
    const first = createSession()
    const second = createSession()
    resolveFetch(new Response(null, { status: 204 }))
    await Promise.all([first, second])

    expect(globalThis.fetch).toHaveBeenCalledTimes(1)
  })

  it('serializes a new user session after the previous user response', async () => {
    mockGetIdToken.mockImplementation(() =>
      Promise.resolve(`firebase-${mockAuthState.currentUser?.uid}`)
    )
    let resolveFirstFetch: (value: Response) => void = () => {}
    vi.mocked(globalThis.fetch)
      .mockReturnValueOnce(
        new Promise<Response>((resolve) => {
          resolveFirstFetch = resolve
        })
      )
      .mockResolvedValueOnce(new Response(null, { status: 204 }))
    const { useSessionCookie } =
      await import('@/platform/auth/session/useSessionCookie')

    const first = useSessionCookie().createSession()
    await vi.waitFor(() => expect(globalThis.fetch).toHaveBeenCalledTimes(1))

    mockAuthState.currentUser = { uid: 'user-b' }
    const second = useSessionCookie().createSession()
    await Promise.resolve()
    await Promise.resolve()
    expect(globalThis.fetch).toHaveBeenCalledTimes(1)
    expect(mockGetIdToken).toHaveBeenCalledTimes(1)

    resolveFirstFetch(new Response(null, { status: 204 }))
    await Promise.all([first, second])

    expect(globalThis.fetch).toHaveBeenCalledTimes(2)
    const firstHeaders = new Headers(
      vi.mocked(globalThis.fetch).mock.calls[0][1]?.headers
    )
    const secondHeaders = new Headers(
      vi.mocked(globalThis.fetch).mock.calls[1][1]?.headers
    )
    expect(firstHeaders.get('Authorization')).toBe('Bearer firebase-user-a')
    expect(secondHeaders.get('Authorization')).toBe('Bearer firebase-user-b')
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
