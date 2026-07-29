import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  createSessionOrThrow: vi.fn(),
  mintAtLogin: vi.fn(),
  getAuthHeader: vi.fn(),
  reconnectSocket: vi.fn(),
  addToast: vi.fn(),
  teamWorkspacesEnabled: { value: true },
  unifiedCloudAuthEnabled: { value: true },
  workspaceInitState: { value: 'uninitialized' },
  workspaceInitialize: vi.fn()
}))

vi.mock('@/composables/useFeatureFlags', () => ({
  useFeatureFlags: () => ({
    flags: {
      teamWorkspacesEnabled: mocks.teamWorkspacesEnabled.value,
      unifiedCloudAuthEnabled: mocks.unifiedCloudAuthEnabled.value
    }
  })
}))

vi.mock('@/platform/workspace/stores/teamWorkspaceStore', () => ({
  useTeamWorkspaceStore: () => ({
    initState: mocks.workspaceInitState.value,
    initialize: mocks.workspaceInitialize
  })
}))

// Keep the real singleton out of unit tests: it opens a live WebSocket.
vi.mock('@/scripts/api', () => ({
  api: { reconnectSocket: mocks.reconnectSocket }
}))

vi.mock('@/platform/workspace/stores/workspaceAuthStore', () => ({
  useWorkspaceAuthStore: () => ({ mintAtLogin: mocks.mintAtLogin })
}))

vi.mock('@/stores/authStore', () => ({
  useAuthStore: () => ({ getAuthHeader: mocks.getAuthHeader })
}))

vi.mock('@/platform/auth/session/useSessionCookie', () => ({
  useSessionCookie: () => ({ createSessionOrThrow: mocks.createSessionOrThrow })
}))

vi.mock('@/platform/updates/common/toastStore', () => ({
  useToastStore: () => ({ add: mocks.addToast })
}))

vi.mock('@/i18n', () => ({ t: (key: string) => key }))

async function load() {
  vi.resetModules()
  const sessionExpiry = await import('@/platform/auth/session/sessionExpiry')
  const { restoreCloudSession } =
    await import('@/platform/auth/session/restoreCloudSession')
  return { restoreCloudSession, ...sessionExpiry }
}

beforeEach(() => {
  vi.clearAllMocks()
  localStorage.clear()
  mocks.createSessionOrThrow.mockResolvedValue(undefined)
  mocks.mintAtLogin.mockResolvedValue(true)
  mocks.getAuthHeader.mockResolvedValue({ Authorization: 'Bearer live' })
  mocks.reconnectSocket.mockResolvedValue(undefined)
  mocks.teamWorkspacesEnabled.value = true
  mocks.unifiedCloudAuthEnabled.value = true
  mocks.workspaceInitState.value = 'uninitialized'
  mocks.workspaceInitialize.mockResolvedValue(undefined)
})

describe('restoreCloudSession', () => {
  it('lifts the suspension once the cookie is back', async () => {
    const { restoreCloudSession, suspendSession, isSessionSuspended } =
      await load()
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    suspendSession()

    await restoreCloudSession()

    expect(isSessionSuspended()).toBe(false)
    warn.mockRestore()
  })

  it('stays suspended and says so when the cookie cannot be minted', async () => {
    mocks.createSessionOrThrow.mockRejectedValue(new Error('mint failed'))
    const { restoreCloudSession, suspendSession, isSessionSuspended } =
      await load()
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    suspendSession()

    await restoreCloudSession()

    expect(isSessionSuspended()).toBe(true)
    expect(mocks.addToast).toHaveBeenCalledTimes(1)
    warn.mockRestore()
  })

  /**
   * The defect this exists to prevent: the resume used to happen only in the
   * auth-resolved hook, which rides Firebase's auth-state observer. That
   * observer reports a uid CHANGE, so signing in again as the same user after a
   * failed mint produced no event, the hook never ran again, and the session
   * could never be recovered without a sign-out that destroys the drafts.
   */
  it('recovers on a retry by the same user, which raises no auth-state change', async () => {
    mocks.createSessionOrThrow.mockRejectedValueOnce(new Error('502'))
    const { restoreCloudSession, suspendSession, isSessionSuspended } =
      await load()
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    suspendSession()

    await restoreCloudSession()
    expect(isSessionSuspended()).toBe(true)

    await restoreCloudSession()

    expect(isSessionSuspended()).toBe(false)
    warn.mockRestore()
  })

  it('stays suspended when no request credential exists, cookie or not', async () => {
    // The cookie is not what api.fetchApi sends. Resuming on it alone clears the
    // banner over an app whose every request still fails.
    mocks.getAuthHeader.mockResolvedValue(null)
    const { restoreCloudSession, suspendSession, isSessionSuspended } =
      await load()
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    suspendSession()

    await restoreCloudSession()

    expect(isSessionSuspended()).toBe(true)
    expect(mocks.addToast).toHaveBeenCalledTimes(1)
    warn.mockRestore()
  })

  it('mints the request credential, not just the cookie', async () => {
    const { restoreCloudSession, suspendSession } = await load()
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    suspendSession()

    await restoreCloudSession()

    expect(mocks.mintAtLogin).toHaveBeenCalledTimes(1)
    warn.mockRestore()
  })

  it('brings realtime back after a suspension, which refused the socket', async () => {
    const { restoreCloudSession, suspendSession } = await load()
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    suspendSession()

    await restoreCloudSession()

    // createSocket refuses while suspended and the close handler's retry is the
    // only other reconnect driver, so without this realtime never returns.
    expect(mocks.reconnectSocket).toHaveBeenCalledTimes(1)
    warn.mockRestore()
  })

  it('resumes before reconnecting, or createSocket refuses and realtime never returns', async () => {
    const { restoreCloudSession, suspendSession, isSessionSuspended } =
      await load()
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    let suspendedAtReconnect: boolean | undefined
    mocks.reconnectSocket.mockImplementation(() => {
      suspendedAtReconnect = isSessionSuspended()
      return Promise.resolve()
    })
    suspendSession()

    await restoreCloudSession()

    // Asserting the call alone passes with the two statements swapped, because
    // createSocket's refusal is silent.
    expect(suspendedAtReconnect).toBe(false)
    warn.mockRestore()
  })

  /**
   * Firebase's sign-out resets the team workspace store, and the only thing
   * that normally re-initializes it is WorkspaceAuthGate's `onMounted`. Because
   * this feature deliberately never navigates, that gate never remounts, so a
   * team user would resume personal-scoped with an account menu that renders
   * neither of its two branches.
   */
  it('restores the team workspace scope the sign-out reset', async () => {
    const { restoreCloudSession, suspendSession } = await load()
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    suspendSession()

    await restoreCloudSession()

    expect(mocks.workspaceInitialize).toHaveBeenCalledTimes(1)
    warn.mockRestore()
  })

  it('leaves workspace init to the gate on an ordinary login', async () => {
    const { restoreCloudSession } = await load()

    await restoreCloudSession()

    expect(mocks.workspaceInitialize).not.toHaveBeenCalled()
  })

  it('does not re-run workspace init that the gate already completed', async () => {
    mocks.workspaceInitState.value = 'ready'
    const { restoreCloudSession, suspendSession } = await load()
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    suspendSession()

    await restoreCloudSession()

    expect(mocks.workspaceInitialize).not.toHaveBeenCalled()
    warn.mockRestore()
  })

  it('skips workspace init entirely when team workspaces are off', async () => {
    mocks.teamWorkspacesEnabled.value = false
    const { restoreCloudSession, suspendSession } = await load()
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    suspendSession()

    await restoreCloudSession()

    expect(mocks.workspaceInitialize).not.toHaveBeenCalled()
    warn.mockRestore()
  })

  it('still resumes when the workspace scope cannot be restored', async () => {
    mocks.workspaceInitialize.mockRejectedValue(new Error('workspaces down'))
    const { restoreCloudSession, suspendSession, isSessionSuspended } =
      await load()
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    suspendSession()

    await restoreCloudSession()

    // The credential is already good; degrading to personal scope beats
    // stranding the user behind a banner that no longer has anything to fix.
    expect(isSessionSuspended()).toBe(false)
    expect(mocks.addToast).not.toHaveBeenCalled()
    expect(mocks.reconnectSocket).toHaveBeenCalledTimes(1)
    warn.mockRestore()
  })

  it('collapses concurrent restores, so one recovery reports itself once', async () => {
    mocks.createSessionOrThrow.mockRejectedValue(new Error('mint failed'))
    const { restoreCloudSession, suspendSession } = await load()
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    suspendSession()

    await Promise.all([restoreCloudSession(), restoreCloudSession()])

    // One "Sign in again" click drives both the banner's own call and the
    // auth-resolved hook, which fires on the re-sign-in transition.
    expect(mocks.createSessionOrThrow).toHaveBeenCalledTimes(1)
    expect(mocks.addToast).toHaveBeenCalledTimes(1)
    warn.mockRestore()
  })

  it('holds the socket until the workspace scope is settled', async () => {
    vi.useFakeTimers()
    try {
      let releaseWorkspaceInit: (() => void) | undefined
      mocks.workspaceInitialize.mockImplementation(
        () =>
          new Promise<void>((resolve) => {
            releaseWorkspaceInit = resolve
          })
      )
      const { restoreCloudSession, suspendSession } = await load()
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
      suspendSession()

      await restoreCloudSession()

      // Driven to just inside the bound rather than asserted on the microtask
      // the restore settles on: there no timer can have fired yet, so the
      // assertion would hold for any bound at all, including one so short it is
      // no wait. The handshake token fixes the socket's scope and nothing
      // re-handshakes on a workspace change, so connecting early strands a team
      // user on a personal-scoped stream.
      await vi.advanceTimersByTimeAsync(29_999)
      expect(mocks.reconnectSocket).not.toHaveBeenCalled()

      releaseWorkspaceInit?.()
      await vi.advanceTimersByTimeAsync(0)
      expect(mocks.reconnectSocket).toHaveBeenCalledTimes(1)
      warn.mockRestore()
    } finally {
      vi.useRealTimers()
    }
  })

  it('connects anyway when the workspace scope restore stalls', async () => {
    vi.useFakeTimers()
    try {
      mocks.workspaceInitialize.mockImplementation(
        () => new Promise<void>(() => {})
      )
      const { restoreCloudSession, suspendSession } = await load()
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
      suspendSession()

      await restoreCloudSession()
      expect(mocks.reconnectSocket).not.toHaveBeenCalled()

      // The socket waits on the scope, so that wait has to be bounded: the
      // workspace list carries no deadline of its own, and a stalled one must
      // cost the scope, not realtime as well.
      await vi.advanceTimersByTimeAsync(30_000)

      expect(mocks.reconnectSocket).toHaveBeenCalledTimes(1)
      warn.mockRestore()
    } finally {
      vi.useRealTimers()
    }
  })

  it('lets a failed mint own its message instead of adding a second', async () => {
    mocks.mintAtLogin.mockResolvedValue(false)
    mocks.getAuthHeader.mockResolvedValue(null)
    const { restoreCloudSession, suspendSession, isSessionSuspended } =
      await load()
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    suspendSession()

    await restoreCloudSession()

    // mintAtLogin surfaces the specific permanent-auth error; ours would name
    // the same failure again, less precisely.
    expect(mocks.addToast).not.toHaveBeenCalled()
    expect(isSessionSuspended()).toBe(true)
    warn.mockRestore()
  })

  it('still reports a failed recovery when unified auth is off', async () => {
    // `mintAtLogin` returns false there without surfacing anything, so reading
    // the bare boolean as "already reported" leaves this path silent: the user
    // completes the provider popup and gets no message at all.
    mocks.unifiedCloudAuthEnabled.value = false
    mocks.mintAtLogin.mockResolvedValue(false)
    mocks.getAuthHeader.mockResolvedValue(null)
    const { restoreCloudSession, suspendSession, isSessionSuspended } =
      await load()
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    suspendSession()

    await restoreCloudSession()

    expect(mocks.addToast).toHaveBeenCalledTimes(1)
    expect(isSessionSuspended()).toBe(true)
    warn.mockRestore()
  })

  it('leaves the socket alone on an ordinary login, so the client id survives', async () => {
    const { restoreCloudSession } = await load()

    await restoreCloudSession()

    expect(mocks.reconnectSocket).not.toHaveBeenCalled()
  })

  it('does not touch the socket when the restore failed', async () => {
    mocks.getAuthHeader.mockResolvedValue(null)
    const { restoreCloudSession, suspendSession } = await load()
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    suspendSession()

    await restoreCloudSession()

    expect(mocks.reconnectSocket).not.toHaveBeenCalled()
    warn.mockRestore()
  })

  it('says nothing on an ordinary login, where no session was ever lost', async () => {
    mocks.createSessionOrThrow.mockRejectedValue(new Error('mint failed'))
    const { restoreCloudSession } = await load()
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})

    await restoreCloudSession()

    // "We couldn't restore your session" is simply untrue here, and the action
    // it suggests would do nothing.
    expect(mocks.addToast).not.toHaveBeenCalled()
    warn.mockRestore()
  })
})
