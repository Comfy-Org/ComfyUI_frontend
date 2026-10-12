import { fromPartial } from '@total-typescript/shoehorn'
import { FirebaseError } from 'firebase/app'
import { AuthErrorCodes } from 'firebase/auth'
import { describe, expect, it, vi } from 'vitest'

import type { FirebaseIdentity } from '@comfyorg/account-core/firebase'

import { useToast } from '@/components/ui/toast/toastStore'
import { useAuthActions } from '@/composables/auth/useAuthActions'
import { useUpdatePassword } from '@/composables/auth/useUpdatePassword'
import { useDialogService } from '@/services/dialogService'
import { useAuthStore } from '@/stores/authStore'

vi.mock(import('@/composables/auth/useAuthActions'))
vi.mock(import('@/services/dialogService'))
vi.mock(import('@/platform/auth/firebaseIdentity'), () => ({
  firebaseIdentity: fromPartial<FirebaseIdentity>({
    onUserChanged: () => () => {},
    onTokenChanged: () => () => {},
    currentUser: () => null
  })
}))

const requiresRecentLogin = () =>
  new FirebaseError(
    AuthErrorCodes.CREDENTIAL_TOO_OLD_LOGIN_AGAIN,
    'requires recent login'
  )

function successToasts() {
  return useToast().toasts.filter((toast) => toast.kind === 'success')
}

function stubAuthStore(firstUpdateError?: Error) {
  const authStore = useAuthStore()
  const updatePassword = vi
    .spyOn(authStore, 'updatePassword')
    .mockResolvedValue()
  if (firstUpdateError) updatePassword.mockRejectedValueOnce(firstUpdateError)
  vi.spyOn(authStore, 'logout').mockResolvedValue()
  return authStore
}

describe(useUpdatePassword, () => {
  it('updates the password and confirms success without asking to sign in again', async () => {
    const authStore = stubAuthStore()
    const requestSignIn = vi.fn(async () => true)

    await useUpdatePassword(requestSignIn)('n3w-Passw0rd!')

    expect(authStore.updatePassword).toHaveBeenCalledExactlyOnceWith(
      'n3w-Passw0rd!'
    )
    expect(successToasts()).toEqual([
      expect.objectContaining({ title: 'Password Updated' })
    ])
    expect(useDialogService().confirm).not.toHaveBeenCalled()
    expect(requestSignIn).not.toHaveBeenCalled()
  })

  it('signs out, asks for sign-in, and retries the same password after requires-recent-login', async () => {
    const authStore = stubAuthStore(requiresRecentLogin())
    vi.mocked(useDialogService().confirm).mockResolvedValue(true)
    const logoutsBeforeSignIn: number[] = []
    const requestSignIn = vi.fn(async () => {
      logoutsBeforeSignIn.push(vi.mocked(authStore.logout).mock.calls.length)
      return true
    })

    await useUpdatePassword(requestSignIn)('n3w-Passw0rd!')

    expect(useDialogService().confirm).toHaveBeenCalledExactlyOnceWith(
      expect.objectContaining({ title: 'Re-authentication Required' })
    )
    expect(logoutsBeforeSignIn).toEqual([1])
    expect(vi.mocked(authStore.updatePassword).mock.calls).toEqual([
      ['n3w-Passw0rd!'],
      ['n3w-Passw0rd!']
    ])
    expect(successToasts()).toEqual([
      expect.objectContaining({ title: 'Password Updated' })
    ])
    expect(useAuthActions().reportError).not.toHaveBeenCalled()
  })

  it.for([
    {
      name: 'the user cancels the re-authentication prompt',
      confirmed: false,
      signedIn: true,
      logouts: 0,
      signInRequests: 0
    },
    {
      name: 'sign-in fails after signing out',
      confirmed: true,
      signedIn: false,
      logouts: 1,
      signInRequests: 1
    }
  ])(
    'stops without retrying or reporting when $name',
    async ({ confirmed, signedIn, logouts, signInRequests }) => {
      const authStore = stubAuthStore(requiresRecentLogin())
      vi.mocked(useDialogService().confirm).mockResolvedValue(confirmed)
      const requestSignIn = vi.fn(async () => signedIn)

      await useUpdatePassword(requestSignIn)('n3w-Passw0rd!')

      expect(authStore.logout).toHaveBeenCalledTimes(logouts)
      expect(requestSignIn).toHaveBeenCalledTimes(signInRequests)
      expect(authStore.updatePassword).toHaveBeenCalledOnce()
      expect(successToasts()).toEqual([])
      expect(useAuthActions().reportError).not.toHaveBeenCalled()
    }
  )

  it('reports any other update failure without offering to sign in again', async () => {
    const failure = new FirebaseError(AuthErrorCodes.WEAK_PASSWORD, 'weak')
    stubAuthStore(failure)
    const requestSignIn = vi.fn(async () => true)

    await useUpdatePassword(requestSignIn)('n3w-Passw0rd!')

    expect(useAuthActions().reportError).toHaveBeenCalledExactlyOnceWith(
      failure
    )
    expect(useDialogService().confirm).not.toHaveBeenCalled()
    expect(requestSignIn).not.toHaveBeenCalled()
  })
})
