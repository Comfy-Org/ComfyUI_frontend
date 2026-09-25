import { fromPartial } from '@total-typescript/shoehorn'
import { useAuthStore } from '@/stores/authStore'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const originalFetch = globalThis.fetch

vi.mock(import('@/platform/distribution/types'), () => ({
  isCloud: true
}))

vi.mock(import('@/scripts/api'))

const mockReportError = vi.hoisted(() => vi.fn())
vi.mock(import('@/platform/telemetry/reportError'), () => ({
  reportError: mockReportError
}))

async function loadUseSessionCookie() {
  return await import('@/platform/auth/session/useSessionCookie')
}

describe('useSessionCookie', () => {
  beforeEach(() => {
    vi.resetModules()
    useAuthStore().currentUser = fromPartial({ uid: 'user-a' })
    globalThis.fetch = vi.fn()
  })

  afterEach(() => {
    // Restore the global fetch so a leaked mock doesn't bleed into later
    // tests that depend on real fetch semantics.
    globalThis.fetch = originalFetch
  })

  it('createSessionOrThrow posts the Firebase token and awaits success', async () => {
    vi.mocked(useAuthStore().getIdToken).mockResolvedValue('firebase-id-token')
    vi.mocked(globalThis.fetch).mockResolvedValue(
      new Response(null, { status: 204 })
    )
    const { useSessionCookie } = await loadUseSessionCookie()

    await useSessionCookie().createSessionOrThrow()

    expect(globalThis.fetch).toHaveBeenCalledWith('/api/auth/session', {
      method: 'POST',
      credentials: 'include',
      headers: {
        Authorization: 'Bearer firebase-id-token' as const,
        'Content-Type': 'application/json'
      }
    })
  })

  it('createSessionOrThrow fails fast without a Firebase token', async () => {
    vi.mocked(useAuthStore().getIdToken).mockResolvedValue(undefined)
    const { useSessionCookie } = await loadUseSessionCookie()

    await expect(useSessionCookie().createSessionOrThrow()).rejects.toThrow(
      'No Firebase token available for session creation'
    )
    expect(globalThis.fetch).not.toHaveBeenCalled()
  })

  it('createSession coalesces concurrent callers into one POST', async () => {
    vi.mocked(useAuthStore().getIdToken).mockResolvedValue('firebase-id-token')
    let resolveFetch: (value: Response) => void = () => {}
    vi.mocked(globalThis.fetch).mockReturnValue(
      new Promise<Response>((resolve) => {
        resolveFetch = resolve
      })
    )
    const { useSessionCookie } = await loadUseSessionCookie()

    const { createSession } = useSessionCookie()
    const first = createSession()
    const second = createSession()
    resolveFetch(new Response(null, { status: 204 }))
    await Promise.all([first, second])

    expect(globalThis.fetch).toHaveBeenCalledTimes(1)
  })

  it('confirms the current session once for workspace token admission', async () => {
    vi.mocked(useAuthStore().getIdToken).mockResolvedValue('firebase-id-token')
    vi.mocked(globalThis.fetch).mockResolvedValue(
      new Response(null, { status: 204 })
    )
    const { useSessionCookie } = await loadUseSessionCookie()

    const { ensureSessionCookie } = useSessionCookie()
    await ensureSessionCookie()
    await ensureSessionCookie()

    expect(globalThis.fetch).toHaveBeenCalledTimes(1)
  })

  it('rejects workspace token admission when session creation fails', async () => {
    vi.mocked(useAuthStore().getIdToken).mockResolvedValue('firebase-id-token')
    vi.mocked(globalThis.fetch).mockResolvedValue(
      new Response(JSON.stringify({ message: 'session denied' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      })
    )
    const { useSessionCookie } = await loadUseSessionCookie()

    await expect(useSessionCookie().ensureSessionCookie()).rejects.toThrow(
      'session denied'
    )
  })

  it('reports a swallowed createSession failure as session_cookie_creation_failure', async () => {
    const consoleWarn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    vi.mocked(useAuthStore().getIdToken).mockResolvedValue('firebase-id-token')
    vi.mocked(globalThis.fetch).mockResolvedValue(
      new Response(JSON.stringify({ message: 'session denied' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      })
    )
    const { useSessionCookie } = await loadUseSessionCookie()

    await useSessionCookie().createSession()

    expect(mockReportError).toHaveBeenCalledExactlyOnceWith(expect.any(Error), {
      errorType: 'session_cookie_creation_failure',
      level: 'warning'
    })
    expect(consoleWarn).not.toHaveBeenCalled()
  })

  it('serializes strict session creation after the previous user response', async () => {
    vi.mocked(useAuthStore().getIdToken).mockImplementation(() =>
      Promise.resolve(`firebase-${useAuthStore().currentUser?.uid}`)
    )
    let resolveFirstFetch: (value: Response) => void = () => {}
    vi.mocked(globalThis.fetch)
      .mockReturnValueOnce(
        new Promise<Response>((resolve) => {
          resolveFirstFetch = resolve
        })
      )
      .mockResolvedValueOnce(new Response(null, { status: 204 }))
    const { useSessionCookie } = await loadUseSessionCookie()

    const first = useSessionCookie().createSession()
    await vi.waitFor(() => expect(globalThis.fetch).toHaveBeenCalledTimes(1))

    useAuthStore().currentUser = fromPartial({ uid: 'user-b' })
    const second = useSessionCookie().createSessionOrThrow()
    await Promise.resolve()
    await Promise.resolve()
    expect(globalThis.fetch).toHaveBeenCalledTimes(1)
    expect(useAuthStore().getIdToken).toHaveBeenCalledTimes(1)

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
    vi.mocked(useAuthStore().getIdToken).mockImplementation(() =>
      Promise.resolve(`firebase-${useAuthStore().currentUser?.uid}`)
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
    const { useSessionCookie } = await loadUseSessionCookie()

    await useSessionCookie().ensureSessionCookie()
    useAuthStore().currentUser = fromPartial({ uid: 'user-b' })
    const userBSession = useSessionCookie().createSession()
    await vi.waitFor(() => expect(globalThis.fetch).toHaveBeenCalledTimes(2))

    useAuthStore().currentUser = fromPartial({ uid: 'user-a' })
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

  it('lets strict creation join an in-flight Firebase request on Cloud', async () => {
    vi.mocked(useAuthStore().getAuthHeader).mockResolvedValue(null)
    vi.mocked(useAuthStore().getIdToken).mockResolvedValue('firebase-id-token')
    vi.mocked(globalThis.fetch).mockResolvedValue(
      new Response(null, { status: 204 })
    )
    const { useSessionCookie } = await loadUseSessionCookie()

    const bestEffort = useSessionCookie().createSession()
    const strict = useSessionCookie().createSessionOrThrow()
    await Promise.all([bestEffort, strict])

    expect(globalThis.fetch).toHaveBeenCalledOnce()
    const headers = new Headers(
      vi.mocked(globalThis.fetch).mock.calls[0][1]?.headers
    )
    expect(headers.get('Authorization')).toBe('Bearer firebase-id-token')
    expect(useAuthStore().getAuthHeader).not.toHaveBeenCalled()
  })

  it('serializes session deletion after an in-flight creation', async () => {
    vi.mocked(useAuthStore().getIdToken).mockResolvedValue('firebase-id-token')
    let resolveCreate: (value: Response) => void = () => {}
    vi.mocked(globalThis.fetch)
      .mockReturnValueOnce(
        new Promise<Response>((resolve) => {
          resolveCreate = resolve
        })
      )
      .mockResolvedValueOnce(new Response(null, { status: 204 }))
    const { useSessionCookie } = await loadUseSessionCookie()

    const create = useSessionCookie().createSession()
    await vi.waitFor(() => expect(globalThis.fetch).toHaveBeenCalledTimes(1))
    const remove = useSessionCookie().deleteSession()

    expect(globalThis.fetch).toHaveBeenCalledTimes(1)
    resolveCreate(new Response(null, { status: 204 }))
    await Promise.all([create, remove])

    expect(globalThis.fetch).toHaveBeenCalledTimes(2)
    expect(vi.mocked(globalThis.fetch).mock.calls[1][1]?.method).toBe('DELETE')
  })

  it('reports a failed session deletion as auth_session_cookie_delete_failed and still resolves', async () => {
    const consoleWarn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    vi.mocked(globalThis.fetch).mockResolvedValue(
      new Response(JSON.stringify({ message: 'cookie for user-a@x.test' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      })
    )
    const { useSessionCookie } = await loadUseSessionCookie()

    await expect(useSessionCookie().deleteSession()).resolves.toBeUndefined()

    expect(mockReportError).toHaveBeenCalledExactlyOnceWith(expect.any(Error), {
      errorType: 'auth_session_cookie_delete_failed',
      tags: {
        failure_kind: 'caught_unexpected',
        feature_area: 'auth',
        operation: 'auth',
        outcome: 'failed'
      },
      context: { had_pending_session_mutation: false },
      level: 'error'
    })
    expect(consoleWarn).not.toHaveBeenCalled()
  })

  it('keeps the server message out of the reported deletion failure', async () => {
    vi.mocked(globalThis.fetch).mockResolvedValue(
      new Response(JSON.stringify({ message: 'cookie for user-a@x.test' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      })
    )
    const { useSessionCookie } = await loadUseSessionCookie()

    await useSessionCookie().deleteSession()

    const [reported, options] = mockReportError.mock.calls[0]
    expect(reported).toEqual(new Error('Session cookie deletion failed'))
    expect(JSON.stringify(options)).not.toContain('user-a@x.test')
  })

  it('flags a concurrent session mutation when deletion fails', async () => {
    let resolveDelete: (value: Response) => void = () => {}
    vi.mocked(useAuthStore().getIdToken).mockResolvedValue('firebase-id-token')
    vi.mocked(globalThis.fetch)
      .mockReturnValueOnce(
        new Promise<Response>((resolve) => {
          resolveDelete = resolve
        })
      )
      .mockResolvedValueOnce(new Response(null, { status: 204 }))
    const { useSessionCookie } = await loadUseSessionCookie()

    const remove = useSessionCookie().deleteSession()
    await vi.waitFor(() => expect(globalThis.fetch).toHaveBeenCalledTimes(1))
    // Queued behind the in-flight DELETE, so it is pending when DELETE fails.
    const create = useSessionCookie().createSession()
    resolveDelete(new Response(null, { status: 500 }))
    await Promise.all([remove, create])

    expect(mockReportError).toHaveBeenCalledWith(
      expect.any(Error),
      expect.objectContaining({
        errorType: 'auth_session_cookie_delete_failed',
        context: { had_pending_session_mutation: true }
      })
    )
  })

  it('createSessionOrThrow fails fast on non-success responses', async () => {
    vi.mocked(useAuthStore().getIdToken).mockResolvedValue('firebase-id-token')
    vi.mocked(globalThis.fetch).mockResolvedValue(
      new Response(JSON.stringify({ message: 'session denied' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      })
    )
    const { useSessionCookie } = await loadUseSessionCookie()

    await expect(useSessionCookie().createSessionOrThrow()).rejects.toThrow(
      'session denied'
    )
  })
})

vi.mock(import('@/scripts/app'))
vi.mock(import('firebase/auth'))
