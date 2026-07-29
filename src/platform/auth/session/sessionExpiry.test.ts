import { beforeEach, describe, expect, it, vi } from 'vitest'

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

  it('warns once, so a 401 storm cannot flood the console', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const { suspendSession } = await loadSessionExpiry()

    suspendSession()
    suspendSession()

    expect(warn).toHaveBeenCalledTimes(1)
    warn.mockRestore()
  })

  it('never navigates, so unsaved work on the canvas survives', async () => {
    const original = Object.getOwnPropertyDescriptor(window, 'location')
    const assign = vi.fn()
    const replace = vi.fn()
    const reload = vi.fn()
    Object.defineProperty(window, 'location', {
      value: {
        assign,
        replace,
        reload,
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

    try {
      const { suspendSession } = await loadSessionExpiry()
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})

      suspendSession()

      expect(assign).not.toHaveBeenCalled()
      expect(replace).not.toHaveBeenCalled()
      expect(reload).not.toHaveBeenCalled()
      warn.mockRestore()
    } finally {
      if (original) Object.defineProperty(window, 'location', original)
    }
  })

  it('resumes once a user signs back in, so traffic recovers without a reload', async () => {
    const { suspendSession, resumeSession, isSessionSuspended } =
      await loadSessionExpiry()

    suspendSession()
    resumeSession()

    expect(isSessionSuspended()).toBe(false)
  })

  it('keeps the reactive mirror in step, since the banner binds to it', async () => {
    const { suspendSession, resumeSession, sessionSuspended } =
      await loadSessionExpiry()

    expect(sessionSuspended.value).toBe(false)
    suspendSession()
    expect(sessionSuspended.value).toBe(true)
    resumeSession()
    expect(sessionSuspended.value).toBe(false)
  })

  it('stays armed until the outermost deliberate sign-out completes', async () => {
    const {
      beginVoluntarySignOut,
      endVoluntarySignOut,
      isVoluntarySignOutInProgress
    } = await loadSessionExpiry()

    beginVoluntarySignOut()
    beginVoluntarySignOut()
    endVoluntarySignOut()
    expect(isVoluntarySignOutInProgress()).toBe(true)

    endVoluntarySignOut()
    expect(isVoluntarySignOutInProgress()).toBe(false)

    // An unbalanced release must not drive the count negative and permanently
    // disarm the guard: without the floor this lands on 0 and the next
    // deliberate sign-out is misread as an expiry.
    endVoluntarySignOut()
    beginVoluntarySignOut()
    expect(isVoluntarySignOutInProgress()).toBe(true)
  })
})

describe('remembered identity', () => {
  it('offers the provider the user actually signed in with', async () => {
    const { adoptIdentity, lastKnownProviderId } = await loadSessionExpiry()

    adoptIdentity('uid-a', 'github.com')

    expect(lastKnownProviderId()).toBe('github.com')
  })

  it('reports no provider when none was captured, so callers offer a choice', async () => {
    const { adoptIdentity, lastKnownProviderId } = await loadSessionExpiry()

    adoptIdentity('uid-a')

    expect(lastKnownProviderId()).toBeUndefined()
  })

  it('recognises the same user returning, and a different one arriving', async () => {
    const { adoptIdentity } = await loadSessionExpiry()

    adoptIdentity('uid-a', 'google.com')

    expect(adoptIdentity('uid-a')).toBe(true)
    expect(adoptIdentity('uid-b')).toBe(false)
  })

  it('keeps work on a cold start, when nothing has been recorded yet', async () => {
    const { adoptIdentity } = await loadSessionExpiry()

    // In-memory identity is null on every page load. Treating that as "someone
    // else" would delete the drafts of the user about to sign in.
    expect(adoptIdentity('uid-a')).toBe(true)
  })

  it('trusts the identity it already holds over an unreadable store', async () => {
    const { adoptIdentity } = await loadSessionExpiry()
    adoptIdentity('uid-a')

    const original = Object.getOwnPropertyDescriptor(window, 'localStorage')
    Object.defineProperty(window, 'localStorage', {
      configurable: true,
      get() {
        throw new Error('private mode')
      }
    })

    try {
      // Falling back to storage here would read as a cold start and hand
      // uid-b everything uid-a left behind.
      expect(adoptIdentity('uid-b')).toBe(false)
    } finally {
      if (original) Object.defineProperty(window, 'localStorage', original)
    }
  })

  it('keeps the work when storage is unreadable, rather than guessing', async () => {
    // Seeded with a different user, so a readable store would answer false.
    const seeding = await loadSessionExpiry()
    seeding.adoptIdentity('uid-b')

    const original = Object.getOwnPropertyDescriptor(globalThis, 'localStorage')
    Object.defineProperty(globalThis, 'localStorage', {
      configurable: true,
      get: () => {
        throw new Error('private mode')
      }
    })

    try {
      const { adoptIdentity } = await loadSessionExpiry()

      // Private browsing throws on access. Treating that as "someone else"
      // would delete the drafts of the user signing in right now.
      expect(adoptIdentity('uid-a')).toBe(true)
    } finally {
      if (original) Object.defineProperty(globalThis, 'localStorage', original)
    }
  })

  it('recognises the previous user across a reload, and a different one', async () => {
    const first = await loadSessionExpiry()
    first.adoptIdentity('uid-a', 'google.com')

    // A reload drops module state but not storage.
    const afterReload = await loadSessionExpiry()

    expect(afterReload.adoptIdentity('uid-a')).toBe(true)

    const secondReload = await loadSessionExpiry()

    expect(secondReload.adoptIdentity('uid-b')).toBe(false)
  })

  it('decides and records atomically, so a second account cannot be compared to itself', async () => {
    const { adoptIdentity } = await loadSessionExpiry()
    adoptIdentity('uid-a', 'google.com')

    // Splitting the verdict from the record is the defect: whoever recorded
    // first overwrote the only evidence of the previous owner, and the later
    // comparison then matched the new account against itself.
    expect(adoptIdentity('uid-b')).toBe(false)
    expect(adoptIdentity('uid-b')).toBe(true)
  })
})
