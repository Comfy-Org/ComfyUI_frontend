import type { UserCredential } from 'firebase/auth'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { effectScope } from 'vue'

import type { PopupSignInOptions } from '@comfyorg/account-core/firebase'

import { useAuthActions } from '@/composables/auth/useAuthActions'
import { useCloudAuthPage } from '@/platform/cloud/onboarding/composables/useCloudAuthPage'

vi.mock(import('@/composables/auth/useAuthActions'))

const onAuthSuccess = vi.hoisted(() => vi.fn())
vi.mock(
  import('@/platform/cloud/onboarding/composables/usePostAuthRedirect'),
  () => ({ usePostAuthRedirect: () => ({ onAuthSuccess }) })
)

const credential = {
  user: { uid: 'u1' }
} as Partial<UserCredential> as UserCredential

function mountPage(isNewUser?: boolean) {
  const scope = effectScope()
  const page = scope.run(() =>
    useCloudAuthPage({
      isNewUser,
      successSummary: 'Signed in',
      defaultRedirect: () => '/'
    })
  )!
  return { page, unmount: () => scope.stop() }
}

/** The popup options the page handed its first sign-in. */
function popupOptions(
  signIn: ReturnType<typeof useAuthActions>['signInWithGoogle']
): PopupSignInOptions {
  const options = vi.mocked(signIn).mock.calls[0]?.[0]
  return options?.popup ?? {}
}

describe('useCloudAuthPage when a closed popup’s result arrives late', () => {
  let actions: ReturnType<typeof useAuthActions>

  beforeEach(() => {
    onAuthSuccess.mockReset()
    actions = useAuthActions()
  })

  it.for([
    ['google', 'signInWithGoogle', 'signInWithGoogle'],
    ['github', 'signInWithGithub', 'signInWithGithub']
  ] as const)(
    'finishes a late %s result and leaves the page as a normal sign-in would',
    async ([, pageMethod, actionMethod]) => {
      const { page } = mountPage()
      await page[pageMethod]()
      expect(
        onAuthSuccess,
        'the popup was reported closed'
      ).not.toHaveBeenCalled()
      vi.mocked(actions[actionMethod]).mockResolvedValueOnce(credential)
      const resumed = Promise.resolve(credential)

      popupOptions(actions[actionMethod]).onResumed?.(resumed)

      await vi.waitFor(() => expect(onAuthSuccess).toHaveBeenCalledOnce())
      expect(actions[actionMethod]).toHaveBeenLastCalledWith(
        expect.objectContaining({ resumed })
      )
    }
  )

  it('keeps sign-up’s new-user flag on the finished late result', async () => {
    const { page } = mountPage(true)
    await page.signInWithGoogle()

    const resumed = Promise.resolve(credential)
    popupOptions(actions.signInWithGoogle).onResumed?.(resumed)

    await vi.waitFor(() =>
      expect(actions.signInWithGoogle).toHaveBeenCalledTimes(2)
    )
    expect(actions.signInWithGoogle).toHaveBeenLastCalledWith(
      expect.objectContaining({ isNewUser: true, resumed })
    )
  })

  it('wants a late result only while the page is still open', async () => {
    const { page, unmount } = mountPage()
    await page.signInWithGoogle()
    const options = popupOptions(actions.signInWithGoogle)

    expect(options.keepLateResult?.()).toBe(true)
    unmount()
    expect(options.keepLateResult?.()).toBe(false)
  })
})
