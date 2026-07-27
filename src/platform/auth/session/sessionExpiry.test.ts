import { FirebaseError } from 'firebase/app'
import { AuthErrorCodes } from 'firebase/auth'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type * as SessionCookieModule from '@/platform/auth/session/useSessionCookie'
import { SessionRequestError } from '@/platform/auth/session/useSessionCookie'

vi.mock('@/platform/distribution/types', () => ({ isCloud: true }))

const mocks = vi.hoisted(() => ({
  getIdToken: vi.fn(),
  currentUser: null as {
    getIdToken: (force: boolean) => Promise<string>
  } | null,
  createSessionOrThrow: vi.fn(),
  deleteSession: vi.fn(),
  logout: vi.fn()
}))

vi.mock('@/stores/authStore', () => ({
  useAuthStore: () => ({ currentUser: mocks.currentUser, logout: mocks.logout })
}))

vi.mock('@/platform/auth/session/useSessionCookie', async () => {
  const actual = await vi.importActual<typeof SessionCookieModule>(
    '@/platform/auth/session/useSessionCookie'
  )
  return {
    SessionRequestError: actual.SessionRequestError,
    useSessionCookie: () => ({
      createSessionOrThrow: mocks.createSessionOrThrow,
      deleteSession: mocks.deleteSession
    })
  }
})

const mockLocation = { href: '' }
Object.defineProperty(window, 'location', {
  value: mockLocation,
  writable: true
})

async function loadSessionExpiry() {
  vi.resetModules()
  return import('@/platform/auth/session/sessionExpiry')
}

function signedInUser() {
  return { getIdToken: mocks.getIdToken }
}

beforeEach(() => {
  vi.clearAllMocks()
  mockLocation.href = ''
  mocks.currentUser = signedInUser()
  mocks.getIdToken.mockResolvedValue('fresh-token')
  mocks.createSessionOrThrow.mockResolvedValue(undefined)
  mocks.deleteSession.mockResolvedValue(undefined)
  mocks.logout.mockResolvedValue(undefined)
})

describe('reportUnauthorized', () => {
  it('does not log out when the session proves healthy, so an endpoint-specific 401 is survivable', async () => {
    const { reportUnauthorized, isSessionTerminated } =
      await loadSessionExpiry()

    await reportUnauthorized()

    expect(mocks.getIdToken).toHaveBeenCalledWith(true)
    expect(mocks.createSessionOrThrow).toHaveBeenCalledTimes(1)
    expect(mocks.logout).not.toHaveBeenCalled()
    expect(mockLocation.href).toBe('')
    expect(isSessionTerminated()).toBe(false)
  })

  it('logs out when the identity provider refuses to re-issue a token', async () => {
    mocks.getIdToken.mockRejectedValue(
      new FirebaseError(AuthErrorCodes.TOKEN_EXPIRED, 'token expired')
    )
    const { reportUnauthorized, isSessionTerminated } =
      await loadSessionExpiry()

    await reportUnauthorized()

    expect(mocks.createSessionOrThrow).not.toHaveBeenCalled()
    expect(mocks.deleteSession).toHaveBeenCalledTimes(1)
    expect(mocks.logout).toHaveBeenCalledTimes(1)
    expect(mockLocation.href).toBe('/cloud/login')
    expect(isSessionTerminated()).toBe(true)
  })

  it('logs out when the backend rejects a freshly refreshed identity', async () => {
    mocks.createSessionOrThrow.mockRejectedValue(
      new SessionRequestError('unauthorized', 401)
    )
    const { reportUnauthorized } = await loadSessionExpiry()

    await reportUnauthorized()

    expect(mocks.logout).toHaveBeenCalledTimes(1)
    expect(mockLocation.href).toBe('/cloud/login')
  })

  it('logs out and redirects exactly once for a burst of concurrent 401s', async () => {
    mocks.createSessionOrThrow.mockRejectedValue(
      new SessionRequestError('unauthorized', 401)
    )
    const { reportUnauthorized } = await loadSessionExpiry()

    await Promise.all(Array.from({ length: 50 }, () => reportUnauthorized()))

    expect(mocks.getIdToken).toHaveBeenCalledTimes(1)
    expect(mocks.createSessionOrThrow).toHaveBeenCalledTimes(1)
    expect(mocks.logout).toHaveBeenCalledTimes(1)
  })

  it('ignores further reports once terminated, so the poll loop cannot restart it', async () => {
    mocks.createSessionOrThrow.mockRejectedValue(
      new SessionRequestError('unauthorized', 401)
    )
    const { reportUnauthorized } = await loadSessionExpiry()

    await reportUnauthorized()
    mockLocation.href = ''
    await reportUnauthorized()

    expect(mocks.logout).toHaveBeenCalledTimes(1)
    expect(mockLocation.href).toBe('')
  })

  it('still redirects when teardown throws, so a failed logout cannot strand the app', async () => {
    mocks.createSessionOrThrow.mockRejectedValue(
      new SessionRequestError('unauthorized', 401)
    )
    mocks.deleteSession.mockRejectedValue(new Error('network down'))
    mocks.logout.mockRejectedValue(new Error('firebase unavailable'))
    const { reportUnauthorized } = await loadSessionExpiry()

    await reportUnauthorized()

    expect(mockLocation.href).toBe('/cloud/login')
  })

  it('never rejects, so the fire-and-forget callers cannot raise unhandled rejections', async () => {
    mocks.getIdToken.mockRejectedValue(new Error('chunk load failed'))
    mocks.createSessionOrThrow.mockRejectedValue(new Error('chunk load failed'))
    const { reportUnauthorized } = await loadSessionExpiry()

    await expect(
      Promise.all(Array.from({ length: 10 }, () => reportUnauthorized()))
    ).resolves.toBeDefined()
    expect(mocks.logout).not.toHaveBeenCalled()
  })

  it('treats a 403 as an authorization refusal, not a revoked session', async () => {
    mocks.createSessionOrThrow.mockRejectedValue(
      new SessionRequestError('forbidden', 403)
    )
    const { reportUnauthorized, isSessionTerminated } =
      await loadSessionExpiry()

    await reportUnauthorized()

    expect(mocks.logout).not.toHaveBeenCalled()
    expect(isSessionTerminated()).toBe(false)
  })

  it('does not burn the cooldown when no user is signed in yet', async () => {
    mocks.currentUser = null
    const { reportUnauthorized } = await loadSessionExpiry()

    await reportUnauthorized()
    mocks.currentUser = signedInUser()
    await reportUnauthorized()

    expect(mocks.createSessionOrThrow).toHaveBeenCalledTimes(1)
  })

  it('gives up with no verdict when an oracle hangs, rather than wedging every later report', async () => {
    vi.useFakeTimers()
    try {
      mocks.createSessionOrThrow.mockReturnValue(new Promise(() => {}))
      const { reportUnauthorized, isSessionTerminated } =
        await loadSessionExpiry()

      const pending = reportUnauthorized()
      await vi.advanceTimersByTimeAsync(15_001)
      await pending

      expect(isSessionTerminated()).toBe(false)
      expect(mocks.logout).not.toHaveBeenCalled()
    } finally {
      vi.useRealTimers()
    }
  })

  it('does not log out when the identity oracle is unreachable', async () => {
    mocks.getIdToken.mockRejectedValue(
      new FirebaseError(AuthErrorCodes.NETWORK_REQUEST_FAILED, 'offline')
    )
    const { reportUnauthorized, isSessionTerminated } =
      await loadSessionExpiry()

    await reportUnauthorized()

    expect(mocks.logout).not.toHaveBeenCalled()
    expect(isSessionTerminated()).toBe(false)
  })

  it('does not log out when the session probe fails for a non-auth reason', async () => {
    mocks.createSessionOrThrow.mockRejectedValue(
      new SessionRequestError('server exploded', 500)
    )
    const { reportUnauthorized } = await loadSessionExpiry()

    await reportUnauthorized()

    expect(mocks.logout).not.toHaveBeenCalled()
    expect(mockLocation.href).toBe('')
  })

  it('does not investigate when no user is signed in', async () => {
    mocks.currentUser = null
    const { reportUnauthorized } = await loadSessionExpiry()

    await reportUnauthorized()

    expect(mocks.createSessionOrThrow).not.toHaveBeenCalled()
    expect(mocks.logout).not.toHaveBeenCalled()
  })

  it('throttles re-investigation after a healthy verdict', async () => {
    const { reportUnauthorized } = await loadSessionExpiry()

    await reportUnauthorized()
    await reportUnauthorized()

    expect(mocks.createSessionOrThrow).toHaveBeenCalledTimes(1)
  })

  it('re-investigates once the throttle window has elapsed', async () => {
    vi.useFakeTimers()
    try {
      const { reportUnauthorized } = await loadSessionExpiry()

      await reportUnauthorized()
      vi.advanceTimersByTime(60_001)
      await reportUnauthorized()

      expect(mocks.createSessionOrThrow).toHaveBeenCalledTimes(2)
    } finally {
      vi.useRealTimers()
    }
  })
})
