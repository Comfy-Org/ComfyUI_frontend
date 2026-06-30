import { useSessionCookie } from '@/platform/auth/session/useSessionCookie'
import { clearOAuthRequestId } from '@/platform/cloud/oauth/oauthState'
import { isCloud } from '@/platform/distribution/types'
import { useExtensionService } from '@/services/extensionService'
import { useAuthStore } from '@/stores/authStore'

/**
 * Cloud-only extension that manages session cookies for authentication.
 * Creates session cookie on login, refreshes it when token refreshes, and deletes on logout.
 */
useExtensionService().registerExtension({
  name: 'Comfy.Cloud.SessionCookie',

  onAuthUserResolved: async () => {
    // Ensure the customer record (and its billing) exists before any other
    // authenticated request fans out. The web login form provisions via
    // executeAuthAction({ createCustomer: true }), but Desktop's native sign-in
    // writes the Firebase credentials to IndexedDB and reloads, resolving the
    // user without ever calling it. That left every Desktop user unprovisioned,
    // so the server raced to provision on concurrent first reads (the
    // customers_pkey duplicate-key / Stripe idempotency 500s). Provision once,
    // up front, instead. Idempotent: a returning user's POST /customers is a
    // no-op, and a failure here must never block session creation — the
    // server-side provisioner stays as a safety net.
    if (isCloud) {
      try {
        await useAuthStore().createCustomer()
      } catch (error) {
        console.warn(
          '[Comfy.Cloud] failed to ensure customer is provisioned',
          error
        )
      }
    }

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
