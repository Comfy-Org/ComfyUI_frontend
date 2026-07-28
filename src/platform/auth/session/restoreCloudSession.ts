import { t } from '@/i18n'
import {
  isSessionSuspended,
  resumeSession
} from '@/platform/auth/session/sessionExpiry'
import { useSessionCookie } from '@/platform/auth/session/useSessionCookie'
import { useToastStore } from '@/platform/updates/common/toastStore'

/**
 * Mints the session cookie and, only if that succeeds, lifts a suspension.
 *
 * Called from both the auth-resolved hook and the banner's re-auth action, and
 * that duplication is deliberate: the hook is driven by Firebase's auth-state
 * observer, which only fires when the uid CHANGES. Re-authenticating as the
 * same user after a failed mint produces no change, so the hook would never run
 * again and the suspension could never be lifted. The banner has to be able to
 * finish its own recovery.
 *
 * Resuming is gated on the cookie actually coming back, since resuming without
 * one clears the banner and leaves an app whose every request fails.
 */
export async function restoreCloudSession(): Promise<void> {
  const wasSuspended = isSessionSuspended()

  try {
    await useSessionCookie().createSessionOrThrow()
    resumeSession()
  } catch (error) {
    console.warn('Session cookie could not be minted:', error)

    // Only the recovery path gets the message. This also runs on an ordinary
    // login, where "we couldn't restore your session" is simply untrue.
    if (wasSuspended) {
      useToastStore().add({
        severity: 'error',
        summary: t('g.error'),
        detail: t('auth.sessionExpired.resumeFailed'),
        life: 5000
      })
    }
  }
}
