import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mockGetIdToken = vi.fn()
const mockGetAuthHeader = vi.fn()
const mockAuthState = vi.hoisted(() => ({
  currentUser: { uid: 'user-a' } as { uid: string } | null
}))
const mockFlags = vi.hoisted(() => ({ teamWorkspacesEnabled: true }))
const originalFetch = globalThis.fetch

vi.mock('@/platform/distribution/types', () => ({
  isCloud: true
}))

vi.mock('@/composables/useFeatureFlags', () => ({
  useFeatureFlags: () => ({
    flags: mockFlags
  })
}))

vi.mock('@/stores/authStore', () => ({
  useAuthStore: () => ({
    getIdToken: mockGetIdToken,
    getAuthHeader: mockGetAuthHeader,
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
    mockGetAuthHeader.mockReset()
    mockAuthState.currentUser = { uid: 'user-a' }
    mockFlags.teamWorkspacesEnabled = true
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

  it('confirms the current session once for workspace token admission', async () => {
    mockGetIdToken.mockResolvedValue('firebase-id-token')
    vi.mocked(globalThis.fetch).mockResolvedValue(
      new Response(null, { status: 204 })
    )
    const { useSessionCookie } =
      await import('@/platform/auth/session/useSessionCookie')

    const { ensureSessionCookie } = useSessionCookie()
    await ensureSessionCookie()
    await ensureSessionCookie()

    expect(globalThis.fetch).toHaveBeenCalledTimes(1)
  })

  it('rejects workspace token admission when session creation fails', async () => {
    mockGetIdToken.mockResolvedValue('firebase-id-token')
    vi.mocked(globalThis.fetch).mockResolvedValue(
      new Response(JSON.stringify({ message: 'session denied' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      })
    )
    const { useSessionCookie } =
      await import('@/platform/auth/session/useSessionCookie')

    await expect(useSessionCookie().ensureSessionCookie()).rejects.toThrow(
      'session denied'
    )
  })

  it('serializes strict session creation after the previous user response', async () => {
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
    const second = useSessionCookie().createSessionOrThrow()
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

  it('reconfirms a cached owner after another owner mutates the cookie', async () => {
    mockGetIdToken.mockImplementation(() =>
      Promise.resolve(`firebase-${mockAuthState.currentUser?.uid}`)
    )
    let resolveUserB: (value: Response) => void = () => {}
    vi.mocked(globalThis.fetch)
      .mockResolvedValueOnce(new Response(null, { status: 204 }))
      .mockReturnValueOnce(
        new Promise<Response>((resolve) => {
          resolveUserB = resolve
        })
      )
      .mockResolvedValueOnce(new Response(null, { status: 204 }))
    const { useSessionCookie } =
      await import('@/platform/auth/session/useSessionCookie')

    await useSessionCookie().ensureSessionCookie()
    mockAuthState.currentUser = { uid: 'user-b' }
    const userBSession = useSessionCookie().createSession()
    await vi.waitFor(() => expect(globalThis.fetch).toHaveBeenCalledTimes(2))

    mockAuthState.currentUser = { uid: 'user-a' }
    const userASession = useSessionCookie().ensureSessionCookie()
    await Promise.resolve()
    expect(globalThis.fetch).toHaveBeenCalledTimes(2)

    resolveUserB(new Response(null, { status: 204 }))
    await Promise.all([userBSession, userASession])

    expect(globalThis.fetch).toHaveBeenCalledTimes(3)
    const finalHeaders = new Headers(
      vi.mocked(globalThis.fetch).mock.calls[2][1]?.headers
    )
    expect(finalHeaders.get('Authorization')).toBe('Bearer firebase-user-a')
  })

  it('does not let strict Firebase creation join a weaker request', async () => {
    mockFlags.teamWorkspacesEnabled = false
    mockGetAuthHeader.mockResolvedValue(null)
    mockGetIdToken.mockResolvedValue('firebase-id-token')
    vi.mocked(globalThis.fetch).mockResolvedValue(
      new Response(null, { status: 204 })
    )
    const { useSessionCookie } =
      await import('@/platform/auth/session/useSessionCookie')

    const bestEffort = useSessionCookie().createSession()
    const strict = useSessionCookie().createSessionOrThrow()
    await Promise.all([bestEffort, strict])

    expect(globalThis.fetch).toHaveBeenCalledOnce()
    const headers = new Headers(
      vi.mocked(globalThis.fetch).mock.calls[0][1]?.headers
    )
    expect(headers.get('Authorization')).toBe('Bearer firebase-id-token')
  })

  it('serializes session deletion after an in-flight creation', async () => {
    mockGetIdToken.mockResolvedValue('firebase-id-token')
    let resolveCreate: (value: Response) => void = () => {}
    vi.mocked(globalThis.fetch)
      .mockReturnValueOnce(
        new Promise<Response>((resolve) => {
          resolveCreate = resolve
        })
      )
      .mockResolvedValueOnce(new Response(null, { status: 204 }))
    const { useSessionCookie } =
      await import('@/platform/auth/session/useSessionCookie')

    const create = useSessionCookie().createSession()
    await vi.waitFor(() => expect(globalThis.fetch).toHaveBeenCalledTimes(1))
    const remove = useSessionCookie().deleteSession()

    expect(globalThis.fetch).toHaveBeenCalledTimes(1)
    resolveCreate(new Response(null, { status: 204 }))
    await Promise.all([create, remove])

    expect(globalThis.fetch).toHaveBeenCalledTimes(2)
    expect(vi.mocked(globalThis.fetch).mock.calls[1][1]?.method).toBe('DELETE')
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
