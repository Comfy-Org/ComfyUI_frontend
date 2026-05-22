import { clearOAuthRequestId } from '@/platform/cloud/oauth/oauthState'
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
    clearOAuthRequestId()
    const { deleteSession } = useSessionCookie()
    await deleteSession()
  }
})
