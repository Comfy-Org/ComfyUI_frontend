import { useFeatureFlags } from '@/composables/useFeatureFlags'
import { isCloud } from '@/platform/distribution/types'
import { api } from '@/scripts/api'
import { useAuthStore } from '@/stores/authStore'

interface InFlightCreateSession {
  ownerUid: string | null
  promise: Promise<void>
}

let inFlightCreateSession: InFlightCreateSession | null = null

/**
 * Session cookie management for cloud authentication.
 * Creates and deletes session cookies on the ComfyUI server.
 */
export const useSessionCookie = () => {
  const createSessionWithHeader = async (
    authHeader: Record<string, string>
  ): Promise<Response> => {
    return await fetch(api.apiURL('/auth/session'), {
      method: 'POST',
      credentials: 'include',
      headers: {
        ...authHeader,
        'Content-Type': 'application/json'
      }
    })
  }

  const readSessionError = async (response: Response): Promise<string> => {
    const errorData: unknown = await response.json().catch(() => null)
    const message = (errorData as { message?: unknown } | null)?.message
    return typeof message === 'string' ? message : response.statusText
  }

  const getFirebaseSessionHeaderOrThrow = async (): Promise<
    Record<string, string>
  > => {
    const firebaseToken = await useAuthStore().getIdToken()
    if (!firebaseToken) {
      throw new Error('No Firebase token available for session creation')
    }

    return { Authorization: `Bearer ${firebaseToken}` }
  }

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
    const ownerUid = useAuthStore().currentUser?.uid ?? null
    if (inFlightCreateSession?.ownerUid === ownerUid) {
      return inFlightCreateSession.promise
    }

    const previousRequest = inFlightCreateSession?.promise
    const request: InFlightCreateSession = {
      ownerUid,
      promise: (previousRequest
        ? previousRequest.catch(() => {})
        : Promise.resolve()
      )
        .then(async () => {
          if ((useAuthStore().currentUser?.uid ?? null) !== ownerUid) return
          await performCreateSession(ownerUid)
        })
        .finally(() => {
          if (inFlightCreateSession === request) {
            inFlightCreateSession = null
          }
        })
    }
    inFlightCreateSession = request
    return request.promise
  }

  const performCreateSession = async (
    expectedOwnerUid: string | null
  ): Promise<void> => {
    const { flags } = useFeatureFlags()
    try {
      const authStore = useAuthStore()

      let authHeader: Record<string, string>

      if (flags.teamWorkspacesEnabled) {
        const firebaseToken = await authStore.getIdToken()
        if (!firebaseToken) {
          console.warn(
            'Failed to create session cookie:',
            'No Firebase token available for session creation'
          )
          return
        }
        authHeader = { Authorization: `Bearer ${firebaseToken}` }
      } else {
        const header = await authStore.getAuthHeader()
        if (!header) {
          console.warn(
            'Failed to create session cookie:',
            'No auth header available for session creation'
          )
          return
        }
        authHeader = header
      }

      if ((authStore.currentUser?.uid ?? null) !== expectedOwnerUid) return

      const response = await createSessionWithHeader(authHeader)

      if (!response.ok) {
        console.warn(
          'Failed to create session cookie:',
          await readSessionError(response)
        )
      }
    } catch (error) {
      console.warn('Failed to create session cookie:', error)
    }
  }

  const createSessionOrThrow = async (): Promise<void> => {
    if (!isCloud) return

    const authHeader = await getFirebaseSessionHeaderOrThrow()
    const response = await createSessionWithHeader(authHeader)
    if (!response.ok) {
      throw new Error(await readSessionError(response))
    }
  }

  /**
   * Deletes the session cookie.
   * Called on logout.
   */
  const deleteSession = async (): Promise<void> => {
    if (!isCloud) return

    try {
      const response = await fetch(api.apiURL('/auth/session'), {
        method: 'DELETE',
        credentials: 'include'
      })

      if (!response.ok) {
        console.warn(
          'Failed to delete session cookie:',
          await readSessionError(response)
        )
      }
    } catch (error) {
      console.warn('Failed to delete session cookie:', error)
    }
  }

  return {
    createSession,
    createSessionOrThrow,
    deleteSession
  }
}
