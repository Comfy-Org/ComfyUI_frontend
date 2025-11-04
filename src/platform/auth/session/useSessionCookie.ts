import { api } from '@/scripts/api'
import { isCloud } from '@/platform/distribution/types'
import { useFirebaseAuthStore } from '@/stores/firebaseAuthStore'

/**
 * Session cookie management for cloud authentication.
 * Creates and deletes session cookies on the ComfyUI server.
 */
export const useSessionCookie = () => {
  /**
   * Creates or refreshes the session cookie.
   * Called after login and on token refresh.
   */
  const createSession = async (): Promise<void> => {
    if (!isCloud) return

    const authStore = useFirebaseAuthStore()
    const authHeader = await authStore.getAuthHeader()

    if (!authHeader) {
      throw new Error('No auth header available for session creation')
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
