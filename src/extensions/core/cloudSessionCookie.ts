import { clearOAuthRequestId } from '@/platform/cloud/oauth/oauthState'
import {
  isVoluntarySignOutInProgress,
  rememberIdentity,
  resumeSession,
  suspendSession
} from '@/platform/auth/session/sessionExpiry'
import { useSessionCookie } from '@/platform/auth/session/useSessionCookie'
import { useExtensionService } from '@/services/extensionService'
import { useAuthStore } from '@/stores/authStore'

/**
 * Cloud-only extension that manages session cookies for authentication.
 * Creates session cookie on login, refreshes it when token refreshes, and deletes on logout.
 */
useExtensionService().registerExtension({
  name: 'Comfy.Cloud.SessionCookie',

  onAuthUserResolved: async (user) => {
    // Captured while the session is healthy: Firebase clears currentUser before
    // an expiry can be observed, taking the provider with it.
    rememberIdentity(
      user.id,
      useAuthStore().currentUser?.providerData[0]?.providerId
    )
    const { createSession } = useSessionCookie()
    await createSession()
    // Only after the cookie is back: resuming first would clear the banner and
    // hand the user a silently failing app if this throws.
    resumeSession()
  },

  onAuthTokenRefreshed: async () => {
    const { createSession } = useSessionCookie()
    await createSession()
  },

  onAuthUserLogout: async () => {
    // Read before the await: the flag is released when the sign-out resolves,
    // which happens while deleteSession is still in flight.
    const deliberate = isVoluntarySignOutInProgress()
    clearOAuthRequestId()
    // Before the awaited teardown, so request seams stop immediately rather
    // than after a network round trip.
    if (!deliberate) suspendSession()
    const { deleteSession } = useSessionCookie()
    await deleteSession()
  }
})
