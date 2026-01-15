import { isCloud } from '@/platform/distribution/types'
import { remoteConfig } from '@/platform/remoteConfig/remoteConfig'
import { api } from '@/scripts/api'
import { useFirebaseAuthStore } from '@/stores/firebaseAuthStore'

/**
 * Session cookie management for cloud authentication.
 * Creates and deletes session cookies on the ComfyUI server.
 */
export const useSessionCookie = () => {
  /**
   * Creates or refreshes the session cookie.
   * Called after login and on token refresh.
   *
   * When team_workspaces_enabled is true, uses Firebase token directly
   * (since getAuthHeader() returns workspace token which shouldn't be used for session creation).
   * When disabled, uses getAuthHeader() for backward compatibility.
   */
  const createSession = async (): Promise<void> => {
    if (!isCloud) return

    const authStore = useFirebaseAuthStore()

    let authHeader: Record<string, string>

    if (remoteConfig.value.team_workspaces_enabled) {
      const firebaseToken = await authStore.getIdToken()
      if (!firebaseToken) {
        throw new Error('No Firebase token available for session creation')
      }
      authHeader = { Authorization: `Bearer ${firebaseToken}` }
    } else {
      const header = await authStore.getAuthHeader()
      if (!header) {
        throw new Error('No auth header available for session creation')
      }
      authHeader = header
    }

    const response = await fetch(api.apiURL('/auth/session'), {
      method: 'POST',
      credentials: 'include',
      headers: {
        ...authHeader,
        'Content-Type': 'application/json'
      }
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      throw new Error(
        `Failed to create session: ${errorData.message || response.statusText}`
      )
    }
  }

  /**
   * Deletes the session cookie.
   * Called on logout.
   */
  const deleteSession = async (): Promise<void> => {
    if (!isCloud) return

    const response = await fetch(api.apiURL('/auth/session'), {
      method: 'DELETE',
      credentials: 'include'
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      throw new Error(
        `Failed to delete session: ${errorData.message || response.statusText}`
      )
    }
  }

  return {
    createSession,
    deleteSession
  }
}
