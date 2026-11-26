import type { UserCredential } from 'firebase/auth'
import { onMounted, onScopeDispose } from 'vue'

import { useAuthActions } from '@/composables/auth/useAuthActions'
import { reportError } from '@comfyorg/telemetry/reportError'
import { isCloud } from '@/platform/distribution/types'
import {
  beginProviderNavigation,
  exchangeProviderReturn,
  takeProviderReturn,
  topLevelProviders
} from './editorProviderNavigation'
import type { EditorProvider } from './editorProviderNavigation'
import type { SocialSignInOptions } from '@/stores/authStore'

type SocialSignIn = (
  options?: SocialSignInOptions
) => Promise<UserCredential | undefined>

/**
 * Google and GitHub sign-in for a page or dialog. A popup the visitor closes
 * fails at once like any other failure; if its result still arrives, it
 * finishes as a sign-in of its own, but only while this scope is alive and no
 * newer sign-in has started from it.
 */
export function useSocialSignIn(options: {
  isNewUser: () => boolean | undefined
  onSignedIn: () => void | Promise<void>
}) {
  const authActions = useAuthActions()
  let alive = true
  onScopeDispose(() => {
    alive = false
  })
  let latest = 0

  /** `undefined` from the provider means useAuthActions already toasted the failure. */
  async function signInWith(
    provider: SocialSignIn,
    resumed?:
      | Promise<UserCredential>
      | ((wanted: () => boolean) => Promise<UserCredential>)
  ): Promise<void> {
    const attempt = ++latest
    const wanted = () => alive && attempt === latest
    const signedIn = await provider({
      isNewUser: options.isNewUser(),
      resumed: typeof resumed === 'function' ? resumed(wanted) : resumed,
      popup: {
        onResumed: (credential) => {
          signInWith(provider, credential).catch((error: unknown) =>
            reportError(error, {
              surface: 'auth',
              errorType: 'auth_late_sign_in_failed'
            })
          )
        },
        keepLateResult: wanted
      }
    })
    if (signedIn && wanted()) await options.onSignedIn()
  }

  const topLevel = isCloud && topLevelProviders
  const action = (provider: EditorProvider) =>
    provider === 'google'
      ? authActions.signInWithGoogle
      : authActions.signInWithGithub
  async function start(provider: EditorProvider) {
    if (!topLevel) return signInWith(action(provider))
    const attempt = ++latest
    try {
      const error = await beginProviderNavigation(
        provider,
        () => alive && attempt === latest
      )
      if (error && alive && attempt === latest) authActions.reportError(error)
    } catch (error) {
      if (alive && attempt === latest) authActions.reportError(error)
    }
  }

  if (topLevel)
    onMounted(async () => {
      try {
        const result = takeProviderReturn()
        if (result instanceof Error) {
          if (alive) authActions.reportError(result)
        } else if (result) {
          await signInWith(action(result.attempt.provider), async (wanted) => {
            const credential = await exchangeProviderReturn(result, wanted)
            return credential instanceof Error
              ? Promise.reject(credential)
              : credential
          })
        }
      } catch (error) {
        if (alive) authActions.reportError(error)
      }
    })

  return {
    signInWithGoogle: () => start('google'),
    signInWithGithub: () => start('github')
  }
}
