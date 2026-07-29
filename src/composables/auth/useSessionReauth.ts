import { ref } from 'vue'

import { useAuthActions } from '@/composables/auth/useAuthActions'
import { resolveAuthProvider } from '@/platform/auth/authProvider'
import { restoreCloudSession } from '@/platform/auth/session/restoreCloudSession'
import { lastKnownProviderId } from '@/platform/auth/session/sessionExpiry'
import { useDialogService } from '@/services/dialogService'

/**
 * Re-authenticates an expired session in place, without leaving the page.
 *
 * The OAuth providers already sign in through a popup window that hands the
 * result back to its opener, so reusing the login surface's own actions keeps
 * the canvas (and any unsaved work on it) alive throughout, and inherits the
 * error toasts and auth telemetry those actions already carry. Email has no
 * popup, so it falls back to the in-app sign-in dialog, which is also the right
 * surface when the provider was never captured and guessing would be worse than
 * asking.
 *
 * The restore is driven from here as well as from the auth-resolved hook. That
 * hook fires on a transition in the resolved user, so it does cover the usual
 * expiry, where the sign-out cleared it first. It does not cover a retry that
 * never cleared it, and then this is the only thing left that can lift the
 * banner. `restoreCloudSession` is single-flight, so both firing is harmless.
 */
export function useSessionReauth() {
  const isReauthenticating = ref(false)

  async function reauthenticate(): Promise<void> {
    if (isReauthenticating.value) return
    isReauthenticating.value = true

    const { signInWithGoogle, signInWithGithub } = useAuthActions()

    try {
      let signedIn: unknown
      switch (resolveAuthProvider(lastKnownProviderId())) {
        case 'google':
          signedIn = await signInWithGoogle()
          break
        case 'github':
          signedIn = await signInWithGithub()
          break
        default:
          signedIn = await useDialogService().showSignInDialog()
      }

      // The shared actions report their own failures and resolve either way,
      // returning nothing when they did not sign anyone in. Their result is the
      // only honest signal: a live `currentUser` proves nothing here, because a
      // restore that failed after a successful sign-in leaves one behind, and
      // the next cancelled popup would then report a failure the user never
      // triggered, on top of the message they already saw.
      if (!signedIn) return

      await restoreCloudSession()
    } finally {
      // Restored even if the dialog throws, so the banner's only route out
      // cannot end up permanently disabled.
      isReauthenticating.value = false
    }
  }

  return { isReauthenticating, reauthenticate }
}
