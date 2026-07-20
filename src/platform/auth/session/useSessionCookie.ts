import { useFeatureFlags } from '@/composables/useFeatureFlags'
import { isCloud } from '@/platform/distribution/types'
import { api } from '@/scripts/api'
import { useAuthStore } from '@/stores/authStore'

interface InFlightCreateSession {
  ownerUid: string | null
  usesFirebaseToken: boolean
  promise: Promise<void>
}

let inFlightCreateSession: InFlightCreateSession | null = null
let confirmedSessionOwnerUid: string | null = null
let sessionMutationTail = Promise.resolve()
let pendingSessionMutations = 0

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
  const performCreateSession = async (
    expectedOwnerUid: string,
    useFirebaseToken: boolean
  ): Promise<void> => {
    const { flags } = useFeatureFlags()
    const authStore = useAuthStore()

    let authHeader: Record<string, string>

    if (useFirebaseToken || flags.teamWorkspacesEnabled) {
      authHeader = await getFirebaseSessionHeaderOrThrow()
    } else {
      const header = await authStore.getAuthHeader()
      if (!header) {
        throw new Error('No auth header available for session creation')
      }
      authHeader = header
    }

    if ((authStore.currentUser?.uid ?? null) !== expectedOwnerUid) {
      throw new Error('Session identity changed during creation')
    }

    const response = await createSessionWithHeader(authHeader)

    if (!response.ok) {
      throw new Error(await readSessionError(response))
    }
  }

  const establishSession = (
    ownerUid: string,
    forceRefresh: boolean,
    useFirebaseToken = false
  ): Promise<void> => {
    if (
      !forceRefresh &&
      pendingSessionMutations === 0 &&
      confirmedSessionOwnerUid === ownerUid
    ) {
      return Promise.resolve()
    }
    if (
      inFlightCreateSession?.ownerUid === ownerUid &&
      (!useFirebaseToken || inFlightCreateSession.usesFirebaseToken)
    ) {
      return inFlightCreateSession.promise
    }

    pendingSessionMutations++
    const request: InFlightCreateSession = {
      ownerUid,
      usesFirebaseToken: useFirebaseToken,
      promise: sessionMutationTail
        .then(async () => {
          if ((useAuthStore().currentUser?.uid ?? null) !== ownerUid) {
            throw new Error('Session identity changed before creation')
          }
          await performCreateSession(ownerUid, useFirebaseToken)
          confirmedSessionOwnerUid = ownerUid
          if ((useAuthStore().currentUser?.uid ?? null) !== ownerUid) {
            throw new Error('Session identity changed during creation')
          }
        })
        .finally(() => {
          pendingSessionMutations--
          if (inFlightCreateSession === request) {
            inFlightCreateSession = null
          }
        })
    }
    inFlightCreateSession = request
    sessionMutationTail = request.promise.catch(() => {})
    return request.promise
  }

  const currentOwnerUidOrThrow = (): string => {
    const ownerUid = useAuthStore().currentUser?.uid
    if (!ownerUid) {
      throw new Error('No authenticated user available for session creation')
    }
    return ownerUid
  }

  const ensureSessionCookie = async (): Promise<void> => {
    if (!isCloud) return
    await establishSession(currentOwnerUidOrThrow(), false)
  }

  const createSession = async (): Promise<void> => {
    if (!isCloud) return
    try {
      await establishSession(currentOwnerUidOrThrow(), true)
    } catch (error) {
      console.warn('Failed to create session cookie:', error)
    }
  }

  const createSessionOrThrow = async (): Promise<void> => {
    if (!isCloud) return
    await establishSession(currentOwnerUidOrThrow(), true, true)
  }

  /**
   * Deletes the session cookie.
   * Called on logout.
   */
  const deleteSession = async (): Promise<void> => {
    if (!isCloud) return
    confirmedSessionOwnerUid = null
    inFlightCreateSession = null

    try {
      pendingSessionMutations++
      const deleteRequest = sessionMutationTail
        .then(async () => {
          const response = await fetch(api.apiURL('/auth/session'), {
            method: 'DELETE',
            credentials: 'include'
          })

          if (!response.ok) {
            throw new Error(await readSessionError(response))
          }
          confirmedSessionOwnerUid = null
        })
        .finally(() => {
          pendingSessionMutations--
        })
      sessionMutationTail = deleteRequest.catch(() => {})
      await deleteRequest
    } catch (error) {
      console.warn('Failed to delete session cookie:', error)
    }
  }

  return {
    createSession,
    createSessionOrThrow,
    ensureSessionCookie,
    deleteSession
  }
}
