import { clearOAuthRequestId } from '@/platform/cloud/oauth/oauthState'
import { endExpiredSession } from '@/platform/auth/session/sessionExpiry'
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
    // Firebase signs the user out itself when the identity provider rejects the
    // credential, which is the only signal that the token is genuinely stale.
    // The voluntary sign-out path redirects on its own; this is idempotent.
    endExpiredSession('identity provider invalidated the credential')
  }
})
