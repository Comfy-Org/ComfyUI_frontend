import { computed, onUnmounted, ref, shallowRef } from 'vue'

import { getComfyApiBaseUrl } from '@/config/comfyApi'
import { t } from '@/i18n'
import { useFirebaseAuthStore } from '@/stores/firebaseAuthStore'
import type { AuthHeader } from '@/types/authTypes'
import type {
  WorkspaceTokenResponse,
  WorkspaceWithRole
} from '@/types/workspaceTypes'

const STORAGE_KEYS = {
  CURRENT_WORKSPACE: 'Comfy.Workspace.Current',
  TOKEN: 'Comfy.Workspace.Token',
  EXPIRES_AT: 'Comfy.Workspace.ExpiresAt'
} as const

const TOKEN_REFRESH_BUFFER_MS = 5 * 60 * 1000

export class WorkspaceAuthError extends Error {
  constructor(
    message: string,
    public readonly code?: string
  ) {
    super(message)
    this.name = 'WorkspaceAuthError'
  }
}

export function useWorkspaceAuth() {
  const firebaseAuthStore = useFirebaseAuthStore()

  const currentWorkspace = shallowRef<WorkspaceWithRole | null>(null)
  const workspaceToken = ref<string | null>(null)
  const isLoading = ref(false)
  const error = ref<Error | null>(null)

  let refreshTimer: ReturnType<typeof setTimeout> | null = null

  const isAuthenticated = computed(
    () => currentWorkspace.value !== null && workspaceToken.value !== null
  )

  function scheduleTokenRefresh(expiresAt: number): void {
    clearRefreshTimer()
    const now = Date.now()
    const refreshAt = expiresAt - TOKEN_REFRESH_BUFFER_MS
    const delay = Math.max(0, refreshAt - now)

    refreshTimer = setTimeout(() => {
      void refreshToken()
    }, delay)
  }

  function clearRefreshTimer(): void {
    if (refreshTimer !== null) {
      clearTimeout(refreshTimer)
      refreshTimer = null
    }
  }

  function persistToSession(
    workspace: WorkspaceWithRole,
    token: string,
    expiresAt: number
  ): void {
    try {
      sessionStorage.setItem(
        STORAGE_KEYS.CURRENT_WORKSPACE,
        JSON.stringify(workspace)
      )
      sessionStorage.setItem(STORAGE_KEYS.TOKEN, token)
      sessionStorage.setItem(STORAGE_KEYS.EXPIRES_AT, expiresAt.toString())
    } catch {
      console.warn('Failed to persist workspace context to sessionStorage')
    }
  }

  function clearSessionStorage(): void {
    try {
      sessionStorage.removeItem(STORAGE_KEYS.CURRENT_WORKSPACE)
      sessionStorage.removeItem(STORAGE_KEYS.TOKEN)
      sessionStorage.removeItem(STORAGE_KEYS.EXPIRES_AT)
    } catch {
      console.warn('Failed to clear workspace context from sessionStorage')
    }
  }

  function initializeFromSession(): boolean {
    try {
      const workspaceJson = sessionStorage.getItem(
        STORAGE_KEYS.CURRENT_WORKSPACE
      )
      const token = sessionStorage.getItem(STORAGE_KEYS.TOKEN)
      const expiresAtStr = sessionStorage.getItem(STORAGE_KEYS.EXPIRES_AT)

      if (!workspaceJson || !token || !expiresAtStr) {
        return false
      }

      const expiresAt = parseInt(expiresAtStr, 10)
      if (isNaN(expiresAt) || expiresAt <= Date.now()) {
        clearSessionStorage()
        return false
      }

      const workspace = JSON.parse(workspaceJson) as WorkspaceWithRole
      currentWorkspace.value = workspace
      workspaceToken.value = token
      error.value = null

      scheduleTokenRefresh(expiresAt)
      return true
    } catch {
      clearSessionStorage()
      return false
    }
  }

  async function switchWorkspace(workspaceId: string): Promise<void> {
    isLoading.value = true
    error.value = null

    try {
      const firebaseToken = await firebaseAuthStore.getIdToken()
      if (!firebaseToken) {
        throw new WorkspaceAuthError(
          t('workspaceAuth.errors.notAuthenticated'),
          'NOT_AUTHENTICATED'
        )
      }

      const response = await fetch(`${getComfyApiBaseUrl()}/api/auth/token`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${firebaseToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ workspace_id: workspaceId })
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        const message = errorData.message || response.statusText

        if (response.status === 401) {
          throw new WorkspaceAuthError(
            t('workspaceAuth.errors.invalidFirebaseToken'),
            'INVALID_FIREBASE_TOKEN'
          )
        }
        if (response.status === 403) {
          throw new WorkspaceAuthError(
            t('workspaceAuth.errors.accessDenied'),
            'ACCESS_DENIED'
          )
        }
        if (response.status === 404) {
          throw new WorkspaceAuthError(
            t('workspaceAuth.errors.workspaceNotFound'),
            'WORKSPACE_NOT_FOUND'
          )
        }

        throw new WorkspaceAuthError(
          t('workspaceAuth.errors.tokenExchangeFailed', { error: message }),
          'TOKEN_EXCHANGE_FAILED'
        )
      }

      const data: WorkspaceTokenResponse = await response.json()
      const expiresAt = new Date(data.expires_at).getTime()

      const workspaceWithRole: WorkspaceWithRole = {
        ...data.workspace,
        role: data.role
      }

      currentWorkspace.value = workspaceWithRole
      workspaceToken.value = data.token

      persistToSession(workspaceWithRole, data.token, expiresAt)
      scheduleTokenRefresh(expiresAt)
    } catch (err) {
      error.value = err instanceof Error ? err : new Error(String(err))
      throw error.value
    } finally {
      isLoading.value = false
    }
  }

  async function refreshToken(): Promise<void> {
    if (!currentWorkspace.value) {
      return
    }

    try {
      await switchWorkspace(currentWorkspace.value.id)
    } catch (err) {
      console.error('Failed to refresh workspace token:', err)
      if (
        err instanceof WorkspaceAuthError &&
        (err.code === 'ACCESS_DENIED' || err.code === 'WORKSPACE_NOT_FOUND')
      ) {
        clearWorkspaceContext()
      }
    }
  }

  function getWorkspaceAuthHeader(): AuthHeader | null {
    if (!workspaceToken.value) {
      return null
    }
    return {
      Authorization: `Bearer ${workspaceToken.value}`
    }
  }

  function clearWorkspaceContext(): void {
    clearRefreshTimer()
    currentWorkspace.value = null
    workspaceToken.value = null
    error.value = null
    clearSessionStorage()
  }

  onUnmounted(() => {
    clearRefreshTimer()
  })

  return {
    currentWorkspace,
    workspaceToken,
    isLoading,
    error,
    isAuthenticated,
    initializeFromSession,
    switchWorkspace,
    refreshToken,
    getWorkspaceAuthHeader,
    clearWorkspaceContext
  }
}
