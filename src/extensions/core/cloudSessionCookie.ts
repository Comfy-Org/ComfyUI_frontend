import { clearOAuthRequestId } from '@/platform/cloud/oauth/oauthState'
import {
  endExpiredSession,
  isVoluntarySignOutInProgress
} from '@/platform/auth/session/sessionExpiry'
import { useSessionCookie } from '@/platform/auth/session/useSessionCookie'
import { useExtensionService } from '@/services/extensionService'

/**
 * Cloud-only extension that manages session cookies for authentication.
 * Creates session cookie on login, refreshes it when token refreshes, and deletes on logout.
 */
useExtensionService().registerExtension({
  name: 'Comfy.Cloud.SessionCookie',

  onAuthUserResolved: async () => {
    const { createSession } = useSessionCookie()
    await createSession()
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
    const { deleteSession } = useSessionCookie()
    await deleteSession()
    if (!deliberate) {
      endExpiredSession('identity provider invalidated the credential')
    }
  }
})
