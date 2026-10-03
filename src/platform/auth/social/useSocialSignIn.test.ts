import type { UserCredential } from 'firebase/auth'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { effectScope } from 'vue'

import type { PopupSignInOptions } from '@comfyorg/account-core/firebase'

import { useAuthActions } from '@/composables/auth/useAuthActions'
import { useSocialSignIn } from '@/platform/auth/social/useSocialSignIn'
import { reportError } from '@/platform/telemetry/reportError'

vi.mock(import('@/composables/auth/useAuthActions'))
vi.mock(import('@/platform/telemetry/reportError'))

const credential = {
  user: { uid: 'u1' }
} as Partial<UserCredential> as UserCredential

function mount(isNewUser = false) {
  const onSignedIn = vi.fn<() => Promise<void>>(async () => {})
  const scope = effectScope()
  const signIn = scope.run(() =>
    useSocialSignIn({ isNewUser: () => isNewUser, onSignedIn })
  )!
  return { signIn, onSignedIn, unmount: () => scope.stop() }
}

/** The popup options the first sign-in handed the provider. */
function popupOptions(
  provider: ReturnType<typeof useAuthActions>['signInWithGoogle']
): PopupSignInOptions {
  return vi.mocked(provider).mock.calls[0]?.[0]?.popup ?? {}
}

function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((settle) => {
    resolve = settle
  })
  return { promise, resolve }
}

describe('useSocialSignIn when a closed popup’s result arrives late', () => {
  let actions: ReturnType<typeof useAuthActions>

  beforeEach(() => {
    actions = useAuthActions()
    for (const provider of [
      actions.signInWithGoogle,
      actions.signInWithGithub
    ]) {
      vi.mocked(provider).mockImplementation(async (options) => {
        options?.popup?.onStarted?.()
        return undefined
      })
    }
  })

  it.for([
    ['google', 'signInWithGoogle', 'signInWithGoogle'],
    ['github', 'signInWithGithub', 'signInWithGithub']
  ] as const)(
    'finishes a late %s result as a normal sign-in would',
    async ([, method, action]) => {
      const { signIn, onSignedIn } = mount()
      await signIn[method]()
      expect(onSignedIn, 'the popup was reported closed').not.toHaveBeenCalled()
      vi.mocked(actions[action]).mockResolvedValueOnce(credential)
      const resumed = Promise.resolve(credential)

      popupOptions(actions[action]).onResumed?.(resumed)

      await vi.waitFor(() => expect(onSignedIn).toHaveBeenCalledOnce())
      expect(actions[action]).toHaveBeenLastCalledWith(
        expect.objectContaining({ resumed })
      )
    }
  )

  it('keeps sign-up’s new-user flag on the finished late result', async () => {
    const { signIn } = mount(true)
    await signIn.signInWithGoogle()
    const resumed = Promise.resolve(credential)

    popupOptions(actions.signInWithGoogle).onResumed?.(resumed)

    await vi.waitFor(() =>
      expect(actions.signInWithGoogle).toHaveBeenCalledTimes(2)
    )
    expect(actions.signInWithGoogle).toHaveBeenLastCalledWith(
      expect.objectContaining({ isNewUser: true, resumed })
    )
  })

  it.for(['signInWithGoogle', 'signInWithGithub'] as const)(
    'finishes the abandoned popup after a blocked %s retry',
    async (retry) => {
      const { signIn, onSignedIn } = mount()
      await signIn.signInWithGoogle()
      const abandoned = popupOptions(actions.signInWithGoogle)
      vi.mocked(actions[retry]).mockResolvedValueOnce(undefined)

      await signIn[retry]()

      expect(abandoned.keepLateResult?.()).toBe(true)
      vi.mocked(actions.signInWithGoogle).mockResolvedValueOnce(credential)
      abandoned.onResumed?.(Promise.resolve(credential))
      await vi.waitFor(() => expect(onSignedIn).toHaveBeenCalledOnce())
    }
  )

  it('never revives a refused attempt when a later popup starts', async () => {
    const { signIn } = mount()
    await signIn.signInWithGoogle()
    vi.mocked(actions.signInWithGoogle).mockResolvedValueOnce(undefined)
    await signIn.signInWithGoogle()
    const refused = vi.mocked(actions.signInWithGoogle).mock.calls[1]?.[0]
      ?.popup

    await signIn.signInWithGithub()

    expect(refused?.keepLateResult?.()).toBe(false)
  })

  it('wants a late result only while the page is open', async () => {
    const { signIn, unmount } = mount()
    await signIn.signInWithGoogle()
    const options = popupOptions(actions.signInWithGoogle)

    expect(options.keepLateResult?.()).toBe(true)
    unmount()
    expect(options.keepLateResult?.()).toBe(false)
  })

  it('does not finish a late result that settles after the page has gone', async () => {
    const { signIn, onSignedIn, unmount } = mount()
    await signIn.signInWithGoogle()
    const exchange = deferred<UserCredential | undefined>()
    vi.mocked(actions.signInWithGoogle).mockReturnValueOnce(exchange.promise)
    popupOptions(actions.signInWithGoogle).onResumed?.(
      Promise.resolve(credential)
    )

    unmount()
    exchange.resolve(credential)
    await Promise.resolve()
    await Promise.resolve()

    expect(onSignedIn).not.toHaveBeenCalled()
  })

  it('lets a newer sign-in win over a late result still settling', async () => {
    const { signIn, onSignedIn } = mount()
    await signIn.signInWithGoogle()
    const exchange = deferred<UserCredential | undefined>()
    vi.mocked(actions.signInWithGoogle).mockReturnValueOnce(exchange.promise)
    popupOptions(actions.signInWithGoogle).onResumed?.(
      Promise.resolve(credential)
    )

    await signIn.signInWithGithub()
    exchange.resolve(credential)
    await vi.waitFor(() =>
      expect(actions.signInWithGoogle).toHaveBeenCalledTimes(2)
    )
    await Promise.resolve()

    expect(onSignedIn).not.toHaveBeenCalled()
  })

  it('reports a failure after a late sign-in instead of leaving it unhandled', async () => {
    const { signIn, onSignedIn } = mount()
    await signIn.signInWithGoogle()
    vi.mocked(actions.signInWithGoogle).mockResolvedValueOnce(credential)
    onSignedIn.mockRejectedValueOnce(new Error('navigation failed'))

    popupOptions(actions.signInWithGoogle).onResumed?.(
      Promise.resolve(credential)
    )

    await vi.waitFor(() => expect(reportError).toHaveBeenCalledOnce())
  })
})
