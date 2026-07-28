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
 * the canvas — and any unsaved work on it — alive throughout, and inherits the
 * error toasts and auth telemetry those actions already carry. Email has no
 * popup, so it falls back to the in-app sign-in dialog, which is also the right
 * surface when the provider was never captured and guessing would be worse than
 * asking.
 *
 * The restore is driven from here rather than left to the auth-resolved hook,
 * because that hook rides Firebase's auth-state observer, which only reports a
 * uid CHANGE. Signing in again as the same user after a failed mint is not a
 * change, so the hook would never fire and the banner could never be cleared.
 */
export function useSessionReauth() {
  const isReauthenticating = ref(false)

  async function reauthenticate(): Promise<void> {
    if (isReauthenticating.value) return
    isReauthenticating.value = true

    const { signInWithGoogle, signInWithGithub } = useAuthActions()

    try {
      switch (resolveAuthProvider(lastKnownProviderId())) {
        case 'google':
          await signInWithGoogle()
          break
        case 'github':
          await signInWithGithub()
          break
        default:
          await useDialogService().showSignInDialog()
      }

      await restoreCloudSession()
    } finally {
      // Restored even if the dialog throws, so the banner's only route out
      // cannot end up permanently disabled.
      isReauthenticating.value = false
    }
  }

  return { isReauthenticating, reauthenticate }
}
