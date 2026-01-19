import { WORKSPACE_STORAGE_KEYS } from '@/platform/auth/workspace/workspaceConstants'

/**
 * Session manager for workspace context.
 * Handles sessionStorage operations and page reloads for workspace switching.
 */
export const sessionManager = {
  /**
   * Get the current workspace ID from sessionStorage
   */
  getCurrentWorkspaceId(): string | null {
    try {
      return sessionStorage.getItem(WORKSPACE_STORAGE_KEYS.CURRENT_WORKSPACE)
    } catch {
      return null
    }
  },

  /**
   * Set the current workspace ID in sessionStorage
   */
  setCurrentWorkspaceId(workspaceId: string): void {
    try {
      sessionStorage.setItem(
        WORKSPACE_STORAGE_KEYS.CURRENT_WORKSPACE,
        workspaceId
      )
    } catch {
      console.warn('Failed to set workspace ID in sessionStorage')
    }
  },

  /**
   * Clear the current workspace ID from sessionStorage
   */
  clearCurrentWorkspaceId(): void {
    try {
      sessionStorage.removeItem(WORKSPACE_STORAGE_KEYS.CURRENT_WORKSPACE)
    } catch {
      console.warn('Failed to clear workspace ID from sessionStorage')
    }
  },

  /**
   * Get the last workspace ID from localStorage (cross-session persistence)
   */
  getLastWorkspaceId(): string | null {
    try {
      return localStorage.getItem(WORKSPACE_STORAGE_KEYS.LAST_WORKSPACE_ID)
    } catch {
      return null
    }
  },

  /**
   * Persist the last workspace ID to localStorage
   */
  setLastWorkspaceId(workspaceId: string): void {
    try {
      localStorage.setItem(
        WORKSPACE_STORAGE_KEYS.LAST_WORKSPACE_ID,
        workspaceId
      )
    } catch {
      console.warn('Failed to persist last workspace ID to localStorage')
    }
  },

  /**
   * Clear the last workspace ID from localStorage
   */
  clearLastWorkspaceId(): void {
    try {
      localStorage.removeItem(WORKSPACE_STORAGE_KEYS.LAST_WORKSPACE_ID)
    } catch {
      console.warn('Failed to clear last workspace ID from localStorage')
    }
  },

  /**
   * Get the workspace token and expiry from sessionStorage
   */
  getWorkspaceToken(): { token: string; expiresAt: number } | null {
    try {
      const token = sessionStorage.getItem(WORKSPACE_STORAGE_KEYS.TOKEN)
      const expiresAtStr = sessionStorage.getItem(
        WORKSPACE_STORAGE_KEYS.EXPIRES_AT
      )
      if (!token || !expiresAtStr) return null

      const expiresAt = parseInt(expiresAtStr, 10)
      if (isNaN(expiresAt)) return null

      return { token, expiresAt }
    } catch {
      return null
    }
  },

  /**
   * Store the workspace token and expiry in sessionStorage
   */
  setWorkspaceToken(token: string, expiresAt: number): void {
    try {
      sessionStorage.setItem(WORKSPACE_STORAGE_KEYS.TOKEN, token)
      sessionStorage.setItem(
        WORKSPACE_STORAGE_KEYS.EXPIRES_AT,
        expiresAt.toString()
      )
    } catch {
      console.warn('Failed to set workspace token in sessionStorage')
    }
  },

  /**
   * Clear the workspace token from sessionStorage
   */
  clearWorkspaceToken(): void {
    try {
      sessionStorage.removeItem(WORKSPACE_STORAGE_KEYS.TOKEN)
      sessionStorage.removeItem(WORKSPACE_STORAGE_KEYS.EXPIRES_AT)
    } catch {
      console.warn('Failed to clear workspace token from sessionStorage')
    }
  },

  /**
   * Switch workspace and reload the page.
   * Clears the old workspace token before reload so fresh token is fetched.
   * Code after calling this won't execute (page is gone).
   */
  switchWorkspaceAndReload(workspaceId: string): void {
    this.clearWorkspaceToken()
    this.setCurrentWorkspaceId(workspaceId)
    this.setLastWorkspaceId(workspaceId)
    window.location.reload()
  },

  /**
   * Clear workspace context and reload (e.g., after deletion).
   * Falls back to personal workspace on next boot.
   */
  clearAndReload(): void {
    this.clearWorkspaceToken()
    this.clearCurrentWorkspaceId()
    window.location.reload()
  }
}
