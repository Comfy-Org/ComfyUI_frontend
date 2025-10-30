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
    if (!isCloud || logoutInProgress) return

    if (inFlightCreateSession) {
      await inFlightCreateSession
      return
    }

    const authStore = useFirebaseAuthStore()

    let controller: AbortController | null = null

    const run = (async () => {
      const authHeader = await authStore.getAuthHeader()

      if (!authHeader) {
        throw new Error('No auth header available for session creation')
      }

      controller = new AbortController()
      currentCreateController = controller

      const response = await fetch(api.apiURL('/auth/session'), {
        method: 'POST',
        credentials: 'include',
        signal: controller.signal,
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
      .catch((error: unknown) => {
        if (isAbortError(error)) return
        throw error
      })
      .finally(() => {
        if (currentCreateController === controller) {
          currentCreateController = null
        }
        inFlightCreateSession = null
      })

    inFlightCreateSession = run
    await run
  }

  /**
   * Deletes the session cookie.
   * Called on logout.
   */
  const deleteSession = async (): Promise<void> => {
    if (!isCloud) return

    logoutInProgress = true

    try {
      if (inFlightCreateSession) {
        currentCreateController?.abort()
        try {
          await inFlightCreateSession
        } catch (error: unknown) {
          if (!isAbortError(error)) {
            throw error
          }
        }
      }

      const response = await fetch(api.apiURL('/auth/session'), {
        method: 'DELETE',
        credentials: 'include'
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(
          `Failed to delete session: ${
            errorData.message || response.statusText
          }`
        )
      }
    } finally {
      logoutInProgress = false
    }
  }

  return {
    createSession,
    deleteSession
  }
}

let inFlightCreateSession: Promise<void> | null = null
let currentCreateController: AbortController | null = null
let logoutInProgress = false

const isAbortError = (error: unknown): boolean => {
  if (!error || typeof error !== 'object') return false
  const name = 'name' in error ? (error as { name?: string }).name : undefined
  return name === 'AbortError'
}
