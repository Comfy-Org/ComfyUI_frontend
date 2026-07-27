import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/platform/distribution/types', () => ({ isCloud: true }))

async function loadSessionExpiry() {
  vi.resetModules()
  return import('@/platform/auth/session/sessionExpiry')
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('suspendSession', () => {
  it('suspends the session so request seams stop generating doomed traffic', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const { suspendSession, isSessionSuspended } = await loadSessionExpiry()

    expect(isSessionSuspended()).toBe(false)
    suspendSession('token revoked')

    expect(isSessionSuspended()).toBe(true)
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('token revoked'))
    warn.mockRestore()
  })

  it('never navigates, so unsaved work on the canvas survives', async () => {
    const assign = vi.fn()
    Object.defineProperty(window, 'location', {
      value: {
        get href() {
          return ''
        },
        set href(value: string) {
          assign(value)
        }
      },
      writable: true,
      configurable: true
    })
    const { suspendSession } = await loadSessionExpiry()

    suspendSession('token revoked')

    expect(assign).not.toHaveBeenCalled()
  })

  it('resumes once a user signs back in, so traffic recovers without a reload', async () => {
    const { suspendSession, resumeSession, isSessionSuspended } =
      await loadSessionExpiry()

    suspendSession('token revoked')
    resumeSession()

    expect(isSessionSuspended()).toBe(false)
  })

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
})

describe('remembered identity', () => {
  it('offers the provider the user actually signed in with', async () => {
    const { rememberIdentity, lastKnownProviderId } = await loadSessionExpiry()

    rememberIdentity('uid-a', 'github.com')

    expect(lastKnownProviderId()).toBe('github.com')
  })

  it('reports no provider when none was captured, so callers offer a choice', async () => {
    const { rememberIdentity, lastKnownProviderId } = await loadSessionExpiry()

    rememberIdentity('uid-a')

    expect(lastKnownProviderId()).toBeUndefined()
  })

  it('recognises the same user returning, and a different one arriving', async () => {
    const { rememberIdentity, isSameUserAsRemembered } =
      await loadSessionExpiry()

    rememberIdentity('uid-a', 'google.com')

    expect(isSameUserAsRemembered('uid-a')).toBe(true)
    expect(isSameUserAsRemembered('uid-b')).toBe(false)
  })

  it('treats an unknown user as different, so work is never inherited', async () => {
    const { isSameUserAsRemembered } = await loadSessionExpiry()

    expect(isSameUserAsRemembered('uid-a')).toBe(false)
  })
})
