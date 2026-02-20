/**
 * Tab State Management - Per-tab workflow pointers in sessionStorage.
 *
 * Uses api.clientId to scope pointers per browser tab.
 * Includes workspaceId for validation to prevent cross-workspace contamination.
 */

import type { ActivePathPointer, OpenPathsPointer } from '../base/draftTypes'
import { getWorkspaceId } from '../base/storageKeys'
import {
  readActivePath,
  readOpenPaths,
  writeActivePath,
  writeOpenPaths
} from '../base/storageIO'
import { api } from '@/scripts/api'

/**
 * Gets the current client ID for browser tab identification.
 * Falls back to initialClientId if clientId is not yet set.
 */
function getClientId(): string | null {
  return api.clientId ?? api.initialClientId ?? null
}

/**
 * Composable for managing per-tab workflow state in sessionStorage.
 */
export function useWorkflowTabState() {
  const currentWorkspaceId = getWorkspaceId()

  /**
   * Gets the active workflow path for the current tab.
   * Returns null if no pointer exists or workspaceId doesn't match.
   */
  function getActivePath(): string | null {
    const clientId = getClientId()
    if (!clientId) return null

    const pointer = readActivePath(clientId)
    if (!pointer) return null

    // Validate workspace - ignore stale pointers from different workspace
    if (pointer.workspaceId !== currentWorkspaceId) return null

    return pointer.path
  }

  /**
   * Sets the active workflow path for the current tab.
   */
  function setActivePath(path: string): void {
    const clientId = getClientId()
    if (!clientId) return

    const pointer: ActivePathPointer = {
      workspaceId: currentWorkspaceId,
      path
    }
    writeActivePath(clientId, pointer)
  }

  /**
   * Gets the open workflow paths for the current tab.
   * Returns null if no pointer exists or workspaceId doesn't match.
   */
  function getOpenPaths(): { paths: string[]; activeIndex: number } | null {
    const clientId = getClientId()
    if (!clientId) return null

    const pointer = readOpenPaths(clientId)
    if (!pointer) return null

    // Validate workspace
    if (pointer.workspaceId !== currentWorkspaceId) return null

    return { paths: pointer.paths, activeIndex: pointer.activeIndex }
  }

  /**
   * Sets the open workflow paths for the current tab.
   */
  function setOpenPaths(paths: string[], activeIndex: number): void {
    const clientId = getClientId()
    if (!clientId) return

    const pointer: OpenPathsPointer = {
      workspaceId: currentWorkspaceId,
      paths,
      activeIndex
    }
    writeOpenPaths(clientId, pointer)
  }

  return {
    getActivePath,
    setActivePath,
    getOpenPaths,
    setOpenPaths
  }
}
