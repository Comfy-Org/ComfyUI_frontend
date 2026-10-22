import { clearOAuthRequestId } from '@/platform/cloud/oauth/oauthState'
import { useSessionCookie } from '@/platform/auth/session/useSessionCookie'
import { useExtensionService } from '@/services/extensionService'

const disposeSessionCookieExtension = useExtensionService().registerExtension({
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

import.meta.hot?.dispose(disposeSessionCookieExtension)
