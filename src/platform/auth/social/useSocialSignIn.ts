import type { UserCredential } from 'firebase/auth'
import { onScopeDispose } from 'vue'

import { useAuthActions } from '@/composables/auth/useAuthActions'
import { reportError } from '@/platform/telemetry/reportError'
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
    resumed?: Promise<UserCredential>
  ): Promise<void> {
    const attempt = ++latest
    const wanted = () => alive && attempt === latest
    const signedIn = await provider({
      isNewUser: options.isNewUser(),
      resumed,
      popup: {
        onResumed: (credential) => {
          signInWith(provider, credential).catch((error: unknown) =>
            reportError(error, { errorType: 'auth_late_sign_in_failed' })
          )
        },
        keepLateResult: wanted
      }
    })
    if (signedIn && wanted()) await options.onSignedIn()
  }

  return {
    signInWithGoogle: () => signInWith(authActions.signInWithGoogle),
    signInWithGithub: () => signInWith(authActions.signInWithGithub)
  }
}
