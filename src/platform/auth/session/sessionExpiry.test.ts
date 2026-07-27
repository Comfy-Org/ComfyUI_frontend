import { beforeEach, describe, expect, it, vi } from 'vitest'

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
    const { endExpiredSession, isSessionTerminated } = await loadSessionExpiry()

    endExpiredSession('token revoked')

    expect(mockLocation.href).toBe('/cloud/login')
    expect(isSessionTerminated()).toBe(true)
  })

  it('redirects only once, however many callers fire', async () => {
    const { endExpiredSession } = await loadSessionExpiry()

    endExpiredSession('token revoked')
    mockLocation.href = ''
    endExpiredSession('cloud session could not be renewed')
    endExpiredSession('token revoked')

    expect(mockLocation.href).toBe('')
  })

  it('does not redirect a user who is already on a public route', async () => {
    mockLocation.pathname = '/cloud/login'
    const { endExpiredSession, isSessionTerminated } = await loadSessionExpiry()

    endExpiredSession('token revoked')

    expect(mockLocation.href).toBe('')
    expect(isSessionTerminated()).toBe(false)
  })

  it('does not interrupt an in-flight sign-in', async () => {
    mockLocation.pathname = '/cloud/oauth/consent'
    const { endExpiredSession } = await loadSessionExpiry()

    endExpiredSession('token revoked')

    expect(mockLocation.href).toBe('')
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
