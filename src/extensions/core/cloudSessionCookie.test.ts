import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  deleteSession: vi.fn(),
  createSession: vi.fn(),
  createSessionOrThrow: vi.fn(),
  clearOAuthRequestId: vi.fn(),
  clearAllV2Storage: vi.fn(),
  closeWorkflow: vi.fn(),
  openWorkflows: [] as { isModified: boolean }[],
  addToast: vi.fn(),
  registerExtension: vi.fn(),
  currentUser: null as { providerData: { providerId: string }[] } | null
}))

vi.mock('@/platform/distribution/types', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  isCloud: true
}))

vi.mock('@/stores/authStore', () => ({
  useAuthStore: () => ({ currentUser: mocks.currentUser })
}))

vi.mock('@/platform/auth/session/useSessionCookie', () => ({
  useSessionCookie: () => ({
    deleteSession: mocks.deleteSession,
    createSession: mocks.createSession,
    createSessionOrThrow: mocks.createSessionOrThrow
  })
}))

vi.mock('@/platform/workflow/persistence/base/storageIO', () => ({
  clearAllV2Storage: mocks.clearAllV2Storage
}))

vi.mock('@/platform/workflow/management/stores/workflowStore', () => ({
  useWorkflowStore: () => ({
    get openWorkflows() {
      return mocks.openWorkflows
    },
    closeWorkflow: mocks.closeWorkflow
  })
}))

vi.mock('@/platform/cloud/oauth/oauthState', () => ({
  clearOAuthRequestId: mocks.clearOAuthRequestId
}))

vi.mock('@/platform/updates/common/toastStore', () => ({
  useToastStore: () => ({ add: mocks.addToast })
}))

vi.mock('@/i18n', () => ({ t: (key: string) => key }))

vi.mock('@/services/extensionService', () => ({
  useExtensionService: () => ({ registerExtension: mocks.registerExtension })
}))

/**
 * Loads the hook and the session module from the same fresh registry, so the
 * assertions read the real singleton the hook mutates rather than a mock of it.
 */
async function loadHook() {
  vi.resetModules()
  await import('@/extensions/core/cloudSessionCookie')
  const sessionExpiry = await import('@/platform/auth/session/sessionExpiry')
  const extension = mocks.registerExtension.mock.calls.at(-1)?.[0] as {
    onAuthUserLogout: () => Promise<void>
    onAuthUserResolved: (user: { id: string }) => Promise<void>
  }
  return { ...extension, ...sessionExpiry }
}

beforeEach(() => {
  vi.clearAllMocks()
  localStorage.clear()
  mocks.currentUser = null
  mocks.openWorkflows = []
  mocks.deleteSession.mockResolvedValue(undefined)
  mocks.createSessionOrThrow.mockResolvedValue(undefined)
})

describe('cloud session cookie logout hook', () => {
  it('suspends the session when the identity provider signed the user out', async () => {
    const { onAuthUserLogout, isSessionSuspended } = await loadHook()
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})

    await onAuthUserLogout()

    expect(mocks.deleteSession).toHaveBeenCalledTimes(1)
    expect(isSessionSuspended()).toBe(true)
    warn.mockRestore()
  })

  /**
   * The regression a synchronous test cannot see: the deliberate sign-out
   * resolves without a network call, so its flag is released while deleteSession
   * is still in flight. Reading the flag after the await always sees false.
   */
  it('does not suspend for a deliberate sign-out that finishes mid-teardown', async () => {
    let releaseDeleteSession: () => void = () => {}
    mocks.deleteSession.mockReturnValue(
      new Promise<void>((resolve) => {
        releaseDeleteSession = () => resolve()
      })
    )
    const {
      onAuthUserLogout,
      beginVoluntarySignOut,
      endVoluntarySignOut,
      isSessionSuspended
    } = await loadHook()
    beginVoluntarySignOut()

    const pending = onAuthUserLogout()
    endVoluntarySignOut()
    releaseDeleteSession()
    await pending

    expect(mocks.deleteSession).toHaveBeenCalledTimes(1)
    expect(isSessionSuspended()).toBe(false)
  })

  it('suspends before the teardown finishes, so seams stop without a round trip', async () => {
    let releaseDeleteSession: () => void = () => {}
    mocks.deleteSession.mockReturnValue(
      new Promise<void>((resolve) => {
        releaseDeleteSession = () => resolve()
      })
    )
    const { onAuthUserLogout, isSessionSuspended } = await loadHook()
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})

    const pending = onAuthUserLogout()

    // Still in flight: waiting on the network here would let the poller fire
    // another round of doomed requests before anything short-circuits them.
    expect(isSessionSuspended()).toBe(true)

    releaseDeleteSession()
    await pending
    warn.mockRestore()
  })

  it('deletes the session cookie either way', async () => {
    const { onAuthUserLogout, beginVoluntarySignOut } = await loadHook()
    beginVoluntarySignOut()

    await onAuthUserLogout()

    expect(mocks.deleteSession).toHaveBeenCalledTimes(1)
    expect(mocks.clearOAuthRequestId).toHaveBeenCalledTimes(1)
  })
})

describe('cloud session cookie resolve hook', () => {
  it('captures the provider while the session is healthy, since expiry erases it', async () => {
    mocks.currentUser = { providerData: [{ providerId: 'github.com' }] }
    const { onAuthUserResolved, lastKnownProviderId } = await loadHook()

    await onAuthUserResolved({ id: 'uid-a' })

    expect(lastKnownProviderId()).toBe('github.com')
  })

  it('resumes the session once the cookie is back', async () => {
    const { onAuthUserResolved, suspendSession, isSessionSuspended } =
      await loadHook()
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    suspendSession()

    await onAuthUserResolved({ id: 'uid-a' })

    expect(isSessionSuspended()).toBe(false)
    warn.mockRestore()
  })

  it('stays suspended when the cookie could not be minted, so the banner survives', async () => {
    mocks.createSessionOrThrow.mockRejectedValue(new Error('mint failed'))
    const { onAuthUserResolved, suspendSession, isSessionSuspended } =
      await loadHook()
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    suspendSession()

    await expect(onAuthUserResolved({ id: 'uid-a' })).resolves.toBeUndefined()

    // Resuming here would drop the banner and leave a signed-in-looking app
    // whose every request fails, with nothing left to suspend it again.
    expect(isSessionSuspended()).toBe(true)
    // And the user is told, rather than left staring at an unchanged banner.
    expect(mocks.addToast).toHaveBeenCalledTimes(1)
    warn.mockRestore()
  })
})

describe('draft ownership', () => {
  it('keeps drafts when the session expires, so re-authenticating restores them', async () => {
    const { onAuthUserLogout } = await loadHook()
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})

    await onAuthUserLogout()

    expect(mocks.clearAllV2Storage).not.toHaveBeenCalled()
    warn.mockRestore()
  })

  it('clears drafts on a deliberate sign-out, so they cannot reach the next person', async () => {
    const { onAuthUserLogout, beginVoluntarySignOut } = await loadHook()
    beginVoluntarySignOut()

    await onAuthUserLogout()

    expect(mocks.clearAllV2Storage).toHaveBeenCalledTimes(1)
  })

  it('keeps drafts when the same user signs back in', async () => {
    const { onAuthUserResolved } = await loadHook()

    await onAuthUserResolved({ id: 'uid-a' })
    await onAuthUserResolved({ id: 'uid-a' })

    expect(mocks.clearAllV2Storage).not.toHaveBeenCalled()
  })

  it('keeps drafts on a cold start, when no previous identity is known', async () => {
    const { onAuthUserResolved } = await loadHook()

    await onAuthUserResolved({ id: 'uid-z' })

    expect(mocks.clearAllV2Storage).not.toHaveBeenCalled()
  })

  /**
   * The canvas-scoped version of this guard could not survive: an expired user
   * is routed to the login view, which unmounts GraphCanvas and disposes every
   * watcher created in its setup. These hooks are registered after an await
   * inside onMounted, so they have no scope and keep running. Deciding here is
   * what makes the guard reachable at the moment a second account arrives.
   */
  it('clears drafts for a different account arriving with no canvas mounted', async () => {
    const { onAuthUserResolved, onAuthUserLogout } = await loadHook()
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    await onAuthUserResolved({ id: 'uid-a' })

    // The session expires and the canvas goes away; nothing else is listening.
    await onAuthUserLogout()
    await onAuthUserResolved({ id: 'uid-b' })

    expect(mocks.clearAllV2Storage).toHaveBeenCalledTimes(1)
    warn.mockRestore()
  })

  it('throws away the previous user open document before a different account gets it', async () => {
    const original = Object.getOwnPropertyDescriptor(window, 'location')
    const reload = vi.fn()
    Object.defineProperty(window, 'location', {
      value: { reload },
      writable: true,
      configurable: true
    })

    try {
      const { onAuthUserResolved } = await loadHook()
      await onAuthUserResolved({ id: 'uid-a' })
      const openDocument = { isModified: true }
      mocks.openWorkflows = [openDocument]

      await onAuthUserResolved({ id: 'uid-b' })

      expect(mocks.clearAllV2Storage).toHaveBeenCalledTimes(1)
      expect(mocks.closeWorkflow).toHaveBeenCalledTimes(1)
      // Cleared first, or the unload confirmation would veto the reload and
      // leave uid-a's document on screen for uid-b.
      expect(openDocument.isModified).toBe(false)
      expect(reload).toHaveBeenCalledTimes(1)
    } finally {
      if (original) Object.defineProperty(window, 'location', original)
    }
  })

  it('does not bounce the page when nothing is open to inherit', async () => {
    const original = Object.getOwnPropertyDescriptor(window, 'location')
    const reload = vi.fn()
    Object.defineProperty(window, 'location', {
      value: { reload },
      writable: true,
      configurable: true
    })

    try {
      const { onAuthUserResolved } = await loadHook()
      await onAuthUserResolved({ id: 'uid-a' })

      // A cold load registers extensions before any workflow is restored.
      await onAuthUserResolved({ id: 'uid-b' })

      expect(mocks.clearAllV2Storage).toHaveBeenCalledTimes(1)
      expect(reload).not.toHaveBeenCalled()
    } finally {
      if (original) Object.defineProperty(window, 'location', original)
    }
  })

  it('keeps the identity through a deliberate sign-out, so a later stranger is still spotted', async () => {
    const {
      onAuthUserResolved,
      onAuthUserLogout,
      beginVoluntarySignOut,
      endVoluntarySignOut
    } = await loadHook()

    await onAuthUserResolved({ id: 'uid-a' })
    beginVoluntarySignOut()
    await onAuthUserLogout()
    endVoluntarySignOut()
    mocks.clearAllV2Storage.mockClear()

    // Forgetting here made uid-b read as a cold start, so the sign-out that
    // never leaves the page handed the next account uid-a's canvas.
    await onAuthUserResolved({ id: 'uid-b' })

    expect(mocks.clearAllV2Storage).toHaveBeenCalledTimes(1)
  })

  it('clears drafts for a different account across a page reload', async () => {
    const first = await loadHook()
    await first.onAuthUserResolved({ id: 'uid-a' })

    // A reload drops module state but not storage, so the persisted uid is the
    // only evidence of who the drafts belong to.
    const afterReload = await loadHook()
    await afterReload.onAuthUserResolved({ id: 'uid-b' })

    expect(mocks.clearAllV2Storage).toHaveBeenCalledTimes(1)
  })
})
