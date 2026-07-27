import { beforeEach, describe, expect, it, vi } from 'vitest'

import { PUBLIC_ROUTE_PATHS } from '@/platform/auth/session/publicRoutes'

vi.mock('@/platform/distribution/types', () => ({ isCloud: true }))

const mockLocation = { href: '', pathname: '/', reload: vi.fn() }
Object.defineProperty(window, 'location', {
  value: mockLocation,
  writable: true
})

async function loadSessionExpiry() {
  vi.resetModules()
  return import('@/platform/auth/session/sessionExpiry')
}

beforeEach(() => {
  vi.clearAllMocks()
  mockLocation.href = ''
  mockLocation.pathname = '/'
})

describe('endExpiredSession', () => {
  it('returns the user to sign-in when the identity provider invalidated the credential', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const { endExpiredSession, isSessionTerminated } = await loadSessionExpiry()

    endExpiredSession('token revoked')

    expect(mockLocation.href).toBe('/cloud/login')
    expect(isSessionTerminated()).toBe(true)
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('token revoked'))
    warn.mockRestore()
  })

  it('redirects only once, however many callers fire', async () => {
    const { endExpiredSession } = await loadSessionExpiry()

    endExpiredSession('token revoked')
    mockLocation.href = ''
    endExpiredSession('cloud session could not be renewed')

    expect(mockLocation.href).toBe('')
  })

  // The live OAuth consent screen is /oauth/consent; /cloud/oauth/consent is a
  // legacy redirect stub, so asserting on it would pass while the real path
  // stayed exposed.
  it.for([...PUBLIC_ROUTE_PATHS, '/oauth/consent?client_id=abc'])(
    'leaves a user alone on the public route %s',
    async (pathname, { expect }) => {
      mockLocation.pathname = pathname
      const { endExpiredSession, isSessionTerminated } =
        await loadSessionExpiry()

      endExpiredSession('token revoked')

      expect(mockLocation.href).toBe('')
      expect(isSessionTerminated()).toBe(false)
    }
  )

  it('reports a deliberate sign-out only while one is in flight', async () => {
    const {
      beginVoluntarySignOut,
      endVoluntarySignOut,
      isVoluntarySignOutInProgress
    } = await loadSessionExpiry()

    expect(isVoluntarySignOutInProgress()).toBe(false)
    beginVoluntarySignOut()
    beginVoluntarySignOut()
    endVoluntarySignOut()
    expect(isVoluntarySignOutInProgress()).toBe(true)
    endVoluntarySignOut()
    expect(isVoluntarySignOutInProgress()).toBe(false)
  })

  it('releases the latch when the browser refuses to leave, rather than bricking the tab', async () => {
    vi.useFakeTimers()
    try {
      const { endExpiredSession, isSessionTerminated } =
        await loadSessionExpiry()

      endExpiredSession('token revoked')
      expect(isSessionTerminated()).toBe(true)

      await vi.advanceTimersByTimeAsync(10_001)

      expect(isSessionTerminated()).toBe(false)
    } finally {
      vi.useRealTimers()
    }
  })

  it('falls back to a reload when assigning the location throws', async () => {
    const { endExpiredSession } = await loadSessionExpiry()
    Object.defineProperty(mockLocation, 'href', {
      set() {
        throw new Error('navigation blocked')
      },
      get() {
        return ''
      },
      configurable: true
    })

    expect(() => endExpiredSession('token revoked')).not.toThrow()
    expect(mockLocation.reload).toHaveBeenCalledTimes(1)

    Object.defineProperty(mockLocation, 'href', {
      value: '',
      writable: true,
      configurable: true
    })
  })
})
