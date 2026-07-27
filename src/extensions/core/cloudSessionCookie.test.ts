import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  deleteSession: vi.fn(),
  createSession: vi.fn(),
  endExpiredSession: vi.fn(),
  isVoluntarySignOutInProgress: vi.fn(() => false),
  clearOAuthRequestId: vi.fn(),
  registerExtension: vi.fn()
}))

vi.mock('@/platform/auth/session/useSessionCookie', () => ({
  useSessionCookie: () => ({
    deleteSession: mocks.deleteSession,
    createSession: mocks.createSession
  })
}))

vi.mock('@/platform/auth/session/sessionExpiry', () => ({
  endExpiredSession: mocks.endExpiredSession,
  isVoluntarySignOutInProgress: mocks.isVoluntarySignOutInProgress
}))

vi.mock('@/platform/cloud/oauth/oauthState', () => ({
  clearOAuthRequestId: mocks.clearOAuthRequestId
}))

vi.mock('@/services/extensionService', () => ({
  useExtensionService: () => ({ registerExtension: mocks.registerExtension })
}))

async function loadHook() {
  vi.resetModules()
  await import('@/extensions/core/cloudSessionCookie')
  const extension = mocks.registerExtension.mock.calls[0][0]
  return extension.onAuthUserLogout as () => Promise<void>
}

beforeEach(() => {
  vi.clearAllMocks()
  mocks.deleteSession.mockResolvedValue(undefined)
  mocks.isVoluntarySignOutInProgress.mockReturnValue(false)
})

describe('cloud session cookie logout hook', () => {
  it('ends the session when the identity provider signed the user out', async () => {
    const onAuthUserLogout = await loadHook()

    await onAuthUserLogout()

    expect(mocks.deleteSession).toHaveBeenCalledTimes(1)
    expect(mocks.endExpiredSession).toHaveBeenCalledTimes(1)
  })

  /**
   * The regression that a synchronous test cannot see: the deliberate sign-out
   * resolves without a network call, so its flag is released while deleteSession
   * is still in flight. Reading the flag after the await always sees false.
   */
  it('does not end the session for a deliberate sign-out that finishes mid-teardown', async () => {
    let releaseDeleteSession: () => void = () => {}
    mocks.deleteSession.mockReturnValue(
      new Promise<void>((resolve) => {
        releaseDeleteSession = () => resolve()
      })
    )
    // In flight when the hook starts, released before the hook resumes.
    mocks.isVoluntarySignOutInProgress.mockReturnValue(true)
    const onAuthUserLogout = await loadHook()

    const pending = onAuthUserLogout()
    mocks.isVoluntarySignOutInProgress.mockReturnValue(false)
    releaseDeleteSession()
    await pending

    expect(mocks.deleteSession).toHaveBeenCalledTimes(1)
    expect(mocks.endExpiredSession).not.toHaveBeenCalled()
  })

  it('deletes the session cookie either way', async () => {
    mocks.isVoluntarySignOutInProgress.mockReturnValue(true)
    const onAuthUserLogout = await loadHook()

    await onAuthUserLogout()

    expect(mocks.deleteSession).toHaveBeenCalledTimes(1)
    expect(mocks.clearOAuthRequestId).toHaveBeenCalledTimes(1)
  })
})
