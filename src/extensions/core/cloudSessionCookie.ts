import { clearOAuthRequestId } from '@/platform/cloud/oauth/oauthState'
import { restoreCloudSession } from '@/platform/auth/session/restoreCloudSession'
import {
  adoptIdentity,
  isVoluntarySignOutInProgress,
  suspendSession
} from '@/platform/auth/session/sessionExpiry'
import { useSessionCookie } from '@/platform/auth/session/useSessionCookie'
import { useWorkflowStore } from '@/platform/workflow/management/stores/workflowStore'
import { clearAllV2Storage } from '@/platform/workflow/persistence/base/storageIO'
import { useExtensionService } from '@/services/extensionService'
import { useAuthStore } from '@/stores/authStore'

/**
 * Cloud-only extension that manages session cookies for authentication.
 * Creates session cookie on login, refreshes it when token refreshes, and deletes on logout.
 *
 * It also decides who owns persisted drafts, because these hooks are the only
 * ones that outlive the canvas: they are registered after an await inside
 * GraphCanvas's onMounted, so no effect scope ever disposes them. The same
 * guard in a canvas-scoped composable dies on the first navigation, and the
 * next account to sign in from the login route inherits the previous one's work.
 */

/**
 * Throws away whatever is still open, for an account that must not receive it.
 *
 * Marked unmodified first so the unload confirmation cannot veto the reload
 * below: that prompt fires exactly when there are unsaved changes, which is
 * precisely this situation, and a cancelled reload would leave the previous
 * user's document on screen for the new one.
 */
async function discardOpenWorkflows(): Promise<boolean> {
  const workflowStore = useWorkflowStore()
  const open = [...workflowStore.openWorkflows]
  if (open.length === 0) return false

  for (const workflow of open) {
    workflow.isModified = false
    await workflowStore.closeWorkflow(workflow)
  }
  return true
}

useExtensionService().registerExtension({
  name: 'Comfy.Cloud.SessionCookie',

  onAuthUserResolved: async (user) => {
    // Captured while the session is healthy: Firebase clears currentUser before
    // an expiry can be observed, taking the provider with it.
    const providerId = useAuthStore().currentUser?.providerData[0]?.providerId

    // Drafts survive an expiry so re-authenticating restores the user's work,
    // but they must not survive into a different account on a shared machine.
    if (!adoptIdentity(user.id, providerId)) {
      clearAllV2Storage()

      // Storage alone is not enough while the previous user's workflow is still
      // open, because the persistence watcher writes it straight back under the
      // new account. Reloading is what guarantees a clean canvas; a page with
      // nothing open has nothing to inherit and must not be bounced.
      if (await discardOpenWorkflows()) {
        window.location.reload()
      }
    }

    await restoreCloudSession()
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

    if (deliberate) {
      // The identity is deliberately NOT forgotten here. It is the only record
      // of who the still-open document belongs to, and sign-outs that never
      // leave the page (the re-authentication prompt) rely on it to tell the
      // same user returning from a different one arriving.
      clearAllV2Storage()
    } else {
      // Before the awaited teardown, so request seams stop immediately rather
      // than after a network round trip.
      suspendSession()
    }

    const { deleteSession } = useSessionCookie()
    await deleteSession()
  }
})
