import { api } from '@/scripts/api'
import { isCloud } from '@/platform/distribution/types'
import { useFirebaseAuthStore } from '@/stores/firebaseAuthStore'

/**
 * Tracks the in-flight createSession request to dedupe concurrent calls.
 */
let createSessionInFlight: Promise<void> | null = null
/**
 * Tracks the in-flight deleteSession request to dedupe concurrent calls.
 */
let deleteSessionInFlight: Promise<void> | null = null

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

    if (createSessionInFlight) {
      await createSessionInFlight
      return
    }

    createSessionInFlight = (async () => {
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
    })()

    try {
      await createSessionInFlight
    } finally {
      createSessionInFlight = null
    }
  }

  /**
   * Deletes the session cookie.
   * Called on logout.
   */
  const deleteSession = async (): Promise<void> => {
    if (!isCloud) return

    if (deleteSessionInFlight) {
      await deleteSessionInFlight
      return
    }

    deleteSessionInFlight = (async () => {
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
    })()

    try {
      await deleteSessionInFlight
    } finally {
      deleteSessionInFlight = null
    }
  }

  return {
    createSession,
    deleteSession
  }
}
