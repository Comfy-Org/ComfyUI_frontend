import { beforeEach, describe, expect, it, vi } from 'vitest'

import { useSessionReauth } from '@/composables/auth/useSessionReauth'

const mocks = vi.hoisted(() => ({
  signInWithGoogle: vi.fn(),
  signInWithGithub: vi.fn(),
  showSignInDialog: vi.fn(),
  restoreCloudSession: vi.fn(),
  lastKnownProviderId: vi.fn<() => string | undefined>()
}))

vi.mock('@/composables/auth/useAuthActions', () => ({
  useAuthActions: () => ({
    signInWithGoogle: mocks.signInWithGoogle,
    signInWithGithub: mocks.signInWithGithub
  })
}))

vi.mock('@/platform/auth/session/restoreCloudSession', () => ({
  restoreCloudSession: mocks.restoreCloudSession
}))

vi.mock('@/services/dialogService', () => ({
  useDialogService: () => ({ showSignInDialog: mocks.showSignInDialog })
}))

vi.mock('@/platform/auth/session/sessionExpiry', () => ({
  lastKnownProviderId: mocks.lastKnownProviderId
}))

beforeEach(() => {
  vi.clearAllMocks()
  // The real actions resolve to a UserCredential on success and to undefined
  // when they reported a failure, so the mocks must carry that signal too.
  mocks.signInWithGoogle.mockResolvedValue({ user: { uid: 'uid-a' } })
  mocks.signInWithGithub.mockResolvedValue({ user: { uid: 'uid-a' } })
  mocks.showSignInDialog.mockResolvedValue(true)
  mocks.restoreCloudSession.mockResolvedValue(undefined)
})

describe('useSessionReauth', () => {
  it('re-authenticates through the provider the user originally used', async () => {
    mocks.lastKnownProviderId.mockReturnValue('google.com')

    await useSessionReauth().reauthenticate()

    expect(mocks.signInWithGoogle).toHaveBeenCalledTimes(1)
    expect(mocks.signInWithGithub).not.toHaveBeenCalled()
    expect(mocks.showSignInDialog).not.toHaveBeenCalled()
  })

  it('uses GitHub when that is how they signed in', async () => {
    mocks.lastKnownProviderId.mockReturnValue('github.com')

    await useSessionReauth().reauthenticate()

    expect(mocks.signInWithGithub).toHaveBeenCalledTimes(1)
    expect(mocks.signInWithGoogle).not.toHaveBeenCalled()
  })

  it('falls back to the in-app dialog for email, which has no popup', async () => {
    mocks.lastKnownProviderId.mockReturnValue('password')

    await useSessionReauth().reauthenticate()

    expect(mocks.showSignInDialog).toHaveBeenCalledTimes(1)
    expect(mocks.signInWithGoogle).not.toHaveBeenCalled()
  })

  it('asks rather than guesses when the provider was never captured', async () => {
    mocks.lastKnownProviderId.mockReturnValue(undefined)

    await useSessionReauth().reauthenticate()

    expect(mocks.showSignInDialog).toHaveBeenCalledTimes(1)
  })

  it('finishes its own recovery, since a same-user retry raises no auth event', async () => {
    mocks.lastKnownProviderId.mockReturnValue('google.com')

    await useSessionReauth().reauthenticate()

    // Leaving the restore to the auth-resolved hook would strand the banner:
    // that hook only runs on a uid change, and a retry is the same uid.
    expect(mocks.restoreCloudSession).toHaveBeenCalledTimes(1)
  })

  it('does not restore on a cancelled retry after an earlier sign-in succeeded', async () => {
    mocks.lastKnownProviderId.mockReturnValue('google.com')
    const { reauthenticate } = useSessionReauth()

    // First attempt signs in but the restore fails, so the banner stays up and
    // a signed-in user is left behind.
    mocks.restoreCloudSession.mockRejectedValueOnce(new Error('mint failed'))
    await reauthenticate().catch(() => {})
    expect(mocks.restoreCloudSession).toHaveBeenCalledTimes(1)

    // Second attempt is cancelled. Reading the leftover user instead of the
    // action's result would restore again and report a failure the user did
    // not trigger.
    mocks.signInWithGoogle.mockResolvedValue(undefined)
    await reauthenticate()

    expect(mocks.restoreCloudSession).toHaveBeenCalledTimes(1)
  })

  it('leaves failure reporting to the shared sign-in action', async () => {
    mocks.lastKnownProviderId.mockReturnValue('google.com')
    // Production contract: the shared action reports its own failure and
    // resolves undefined either way. It cannot reject.
    mocks.signInWithGoogle.mockResolvedValue(undefined)
    const { reauthenticate, isReauthenticating } = useSessionReauth()

    await reauthenticate()

    // Nothing returned means nobody signed in. Restoring anyway would toast
    // "we couldn't restore your session" for a cancel the user chose.
    expect(mocks.restoreCloudSession).not.toHaveBeenCalled()
    expect(isReauthenticating.value).toBe(false)
  })

  it('frees the action again when the sign-in dialog throws', async () => {
    mocks.lastKnownProviderId.mockReturnValue(undefined)
    mocks.showSignInDialog.mockRejectedValue(new Error('dialog exploded'))
    const { reauthenticate, isReauthenticating } = useSessionReauth()

    await expect(reauthenticate()).rejects.toThrow('dialog exploded')

    // A stuck flag would permanently disable the banner's only way out.
    expect(isReauthenticating.value).toBe(false)
  })

  it('ignores a second click while the first is still open', async () => {
    mocks.lastKnownProviderId.mockReturnValue('google.com')
    let release: () => void = () => {}
    mocks.signInWithGoogle.mockReturnValue(
      new Promise<void>((resolve) => {
        release = () => resolve()
      })
    )
    const { reauthenticate } = useSessionReauth()

    const first = reauthenticate()
    await reauthenticate()
    release()
    await first

    expect(mocks.signInWithGoogle).toHaveBeenCalledTimes(1)
  })
})
