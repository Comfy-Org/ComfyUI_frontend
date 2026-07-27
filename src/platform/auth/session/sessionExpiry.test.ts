import { FirebaseError } from 'firebase/app'
import { AuthErrorCodes } from 'firebase/auth'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type * as SessionCookieModule from '@/platform/auth/session/useSessionCookie'
import { SessionRequestError } from '@/platform/auth/session/useSessionCookie'

vi.mock('@/platform/distribution/types', () => ({ isCloud: true }))

vi.mock('@/i18n', () => ({ t: (key: string) => key }))

const mocks = vi.hoisted(() => ({
  getIdToken: vi.fn(),
  currentUser: null as {
    getIdToken: (force: boolean) => Promise<string>
  } | null,
  createSessionOrThrow: vi.fn(),
  deleteSession: vi.fn(),
  logout: vi.fn(),
  toastAdd: vi.fn()
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

vi.mock('@/platform/updates/common/toastStore', () => ({
  useToastStore: () => ({ add: mocks.toastAdd })
}))

const mockLocation = { href: '' }
Object.defineProperty(window, 'location', {
  value: mockLocation,
  writable: true
})

/** Module state is intentionally module-scoped, so each test gets a fresh copy. */
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
    expect(mocks.toastAdd).toHaveBeenCalledTimes(1)
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
