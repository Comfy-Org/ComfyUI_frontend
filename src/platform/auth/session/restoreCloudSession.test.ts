import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  createSessionOrThrow: vi.fn(),
  addToast: vi.fn()
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
