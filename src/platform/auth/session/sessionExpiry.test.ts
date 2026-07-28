import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/platform/distribution/types', () => ({ isCloud: true }))

async function loadSessionExpiry() {
  vi.resetModules()
  return import('@/platform/auth/session/sessionExpiry')
}

beforeEach(() => {
  vi.clearAllMocks()
  localStorage.clear()
})

describe('suspendSession', () => {
  it('suspends the session so request seams stop generating doomed traffic', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const { suspendSession, isSessionSuspended } = await loadSessionExpiry()

    expect(isSessionSuspended()).toBe(false)
    suspendSession()

    expect(isSessionSuspended()).toBe(true)
    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining('rejected the credential')
    )
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

    suspendSession()

    expect(assign).not.toHaveBeenCalled()
  })

  it('resumes once a user signs back in, so traffic recovers without a reload', async () => {
    const { suspendSession, resumeSession, isSessionSuspended } =
      await loadSessionExpiry()

    suspendSession()
    resumeSession()

    expect(isSessionSuspended()).toBe(false)
  })

  it('counts nested deliberate sign-outs', async () => {
    const { beginVoluntarySignOut, endVoluntarySignOut } =
      await loadSessionExpiry()

    beginVoluntarySignOut()
    beginVoluntarySignOut()
    endVoluntarySignOut()
    endVoluntarySignOut()
    endVoluntarySignOut()

    // Floors at zero, so an unbalanced release cannot drive it negative and
    // permanently disarm the guard.
    expect(localStorage.getItem('Comfy.Cloud.VoluntarySignOut')).not.toBeNull()
  })

  it('tells a sibling tab that this sign-out was deliberate', async () => {
    const { beginVoluntarySignOut } = await loadSessionExpiry()
    beginVoluntarySignOut()

    // A second tab has its own module state and never called begin; Firebase
    // propagates the sign-out to it through the same shared storage.
    const sibling = await loadSessionExpiry()

    expect(sibling.isVoluntarySignOutInProgress()).toBe(true)
  })

  it('stops trusting a stale marker, so it cannot mask a later expiry', async () => {
    vi.useFakeTimers()
    try {
      const { beginVoluntarySignOut } = await loadSessionExpiry()
      beginVoluntarySignOut()

      vi.advanceTimersByTime(10_001)
      const sibling = await loadSessionExpiry()

      expect(sibling.isVoluntarySignOutInProgress()).toBe(false)
    } finally {
      vi.useRealTimers()
    }
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

  it('keeps work on a cold start, when nothing has been recorded yet', async () => {
    const { isSameUserAsRemembered } = await loadSessionExpiry()

    // In-memory identity is null on every page load. Treating that as "someone
    // else" would delete the drafts of the user about to sign in.
    expect(isSameUserAsRemembered('uid-a')).toBe(true)
  })

  it('recognises the previous user across a reload, and a different one', async () => {
    const first = await loadSessionExpiry()
    first.rememberIdentity('uid-a', 'google.com')

    // A reload drops module state but not storage.
    const afterReload = await loadSessionExpiry()

    expect(afterReload.isSameUserAsRemembered('uid-a')).toBe(true)
    expect(afterReload.isSameUserAsRemembered('uid-b')).toBe(false)
  })
})
