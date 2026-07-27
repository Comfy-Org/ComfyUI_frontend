import { beforeEach, describe, expect, it, vi } from 'vitest'

import { useSessionReauth } from '@/composables/auth/useSessionReauth'

const mocks = vi.hoisted(() => ({
  loginWithGoogle: vi.fn(),
  loginWithGithub: vi.fn(),
  showSignInDialog: vi.fn(),
  lastKnownProviderId: vi.fn<() => string | undefined>()
}))

vi.mock('@/stores/authStore', () => ({
  useAuthStore: () => ({
    loginWithGoogle: mocks.loginWithGoogle,
    loginWithGithub: mocks.loginWithGithub
  })
}))

vi.mock('@/services/dialogService', () => ({
  useDialogService: () => ({ showSignInDialog: mocks.showSignInDialog })
}))

vi.mock('@/platform/auth/session/sessionExpiry', () => ({
  lastKnownProviderId: mocks.lastKnownProviderId
}))

beforeEach(() => {
  vi.clearAllMocks()
  mocks.loginWithGoogle.mockResolvedValue(undefined)
  mocks.loginWithGithub.mockResolvedValue(undefined)
  mocks.showSignInDialog.mockResolvedValue(true)
})

describe('useSessionReauth', () => {
  it('re-authenticates through the provider the user originally used', async () => {
    mocks.lastKnownProviderId.mockReturnValue('google.com')

    await useSessionReauth().reauthenticate()

    expect(mocks.loginWithGoogle).toHaveBeenCalledTimes(1)
    expect(mocks.loginWithGithub).not.toHaveBeenCalled()
    expect(mocks.showSignInDialog).not.toHaveBeenCalled()
  })

  it('uses GitHub when that is how they signed in', async () => {
    mocks.lastKnownProviderId.mockReturnValue('github.com')

    await useSessionReauth().reauthenticate()

    expect(mocks.loginWithGithub).toHaveBeenCalledTimes(1)
    expect(mocks.loginWithGoogle).not.toHaveBeenCalled()
  })

  it('falls back to the in-app dialog for email, which has no popup', async () => {
    mocks.lastKnownProviderId.mockReturnValue('password')

    await useSessionReauth().reauthenticate()

    expect(mocks.showSignInDialog).toHaveBeenCalledTimes(1)
    expect(mocks.loginWithGoogle).not.toHaveBeenCalled()
  })

  it('asks rather than guesses when the provider was never captured', async () => {
    mocks.lastKnownProviderId.mockReturnValue(undefined)

    await useSessionReauth().reauthenticate()

    expect(mocks.showSignInDialog).toHaveBeenCalledTimes(1)
  })

  it('survives a cancelled popup so the banner can be retried', async () => {
    mocks.lastKnownProviderId.mockReturnValue('google.com')
    mocks.loginWithGoogle.mockRejectedValue(
      new Error('auth/popup-closed-by-user')
    )
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const { reauthenticate, isReauthenticating } = useSessionReauth()

    await expect(reauthenticate()).resolves.toBeUndefined()

    expect(isReauthenticating.value).toBe(false)
    warn.mockRestore()
  })

  it('ignores a second click while the first is still open', async () => {
    mocks.lastKnownProviderId.mockReturnValue('google.com')
    let release: () => void = () => {}
    mocks.loginWithGoogle.mockReturnValue(
      new Promise<void>((resolve) => {
        release = () => resolve()
      })
    )
    const { reauthenticate } = useSessionReauth()

    const first = reauthenticate()
    await reauthenticate()
    release()
    await first

    expect(mocks.loginWithGoogle).toHaveBeenCalledTimes(1)
  })
})
