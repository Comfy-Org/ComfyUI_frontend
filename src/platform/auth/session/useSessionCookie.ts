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
   * Implements retry logic with token refresh for handling timing issues.
   */
  const createSession = async (): Promise<void> => {
    if (!isCloud) return

    const authStore = useFirebaseAuthStore()

    // Simple retry with forceRefresh for token timing issues
    for (let attempt = 0; attempt < 3; attempt++) {
      // First attempt uses cached token, retries force refresh
      const authHeader = await authStore.getAuthHeader(attempt > 0)

      if (authHeader) {
        // Successfully got auth header, proceed with session creation
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

        return // Success
      }

      // Exponential backoff before retry (except for last attempt)
      if (attempt < 2) {
        await new Promise((r) => setTimeout(r, Math.pow(2, attempt) * 500))
      }
    }

    // Failed to get auth header after 3 attempts
    throw new Error(
      'No auth header available for session creation after retries'
    )
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
