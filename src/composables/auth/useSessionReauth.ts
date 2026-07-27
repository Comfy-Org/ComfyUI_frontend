import { ref } from 'vue'

import { lastKnownProviderId } from '@/platform/auth/session/sessionExpiry'
import { useDialogService } from '@/services/dialogService'
import { useAuthStore } from '@/stores/authStore'

/**
 * Re-authenticates an expired session in place, without leaving the page.
 *
 * The OAuth providers already sign in through a popup window that hands the
 * result back to its opener, so reusing the login surface's own calls keeps the
 * canvas — and any unsaved work on it — alive throughout. Email has no popup,
 * so it falls back to the in-app sign-in dialog, which is also the right
 * surface when the provider was never captured and guessing would be worse
 * than asking.
 *
 * Nothing here resumes the session: a successful sign-in resolves a user, and
 * the existing auth wiring re-mints the token, re-creates the session cookie
 * and clears the suspension.
 */
export function useSessionReauth() {
  const isReauthenticating = ref(false)

  async function reauthenticate(): Promise<void> {
    if (isReauthenticating.value) return
    isReauthenticating.value = true

    const authStore = useAuthStore()
    const providerId = lastKnownProviderId()

    try {
      if (providerId?.includes('google')) {
        await authStore.loginWithGoogle()
      } else if (providerId?.includes('github')) {
        await authStore.loginWithGithub()
      } else {
        await useDialogService().showSignInDialog()
      }
    } catch (error) {
      // Closing or blocking the popup is a choice, not a fault: the banner is
      // still on screen with the same action, so let them try again.
      console.warn('Session re-authentication did not complete:', error)
    } finally {
      isReauthenticating.value = false
    }
  }

  return { isReauthenticating, reauthenticate }
}
