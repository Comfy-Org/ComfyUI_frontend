import { WORKSPACE_STORAGE_KEYS } from '@/platform/workspace/workspaceConstants'
import { isCloud } from '@/platform/distribution/types'

/**
 * Gets the current workspace ID from sessionStorage.
 * Returns 'personal' for personal workspace or when no workspace is set.
 *
 * NOTE: This is called fresh each time rather than cached at module load,
 * because the workspace auth store may not have set sessionStorage yet
 * when this module is first imported.
 */
export function getWorkspaceId(): string {
  if (!isCloud) return 'personal'

  try {
    const json = sessionStorage.getItem(
      WORKSPACE_STORAGE_KEYS.CURRENT_WORKSPACE
    )
    if (!json) return 'personal'

    const workspace = JSON.parse(json)
    if (workspace.type === 'personal' || !workspace.id) return 'personal'
    return workspace.id
  } catch {
    return 'personal'
  }
}

/**
 * Storage key generators for workflow persistence.
 *
 * localStorage keys are scoped by workspaceId.
 * sessionStorage keys are scoped by clientId.
 */
export const StorageKeys = {
  /**
   * Draft index key for localStorage.
   * Contains LRU order and metadata for all drafts.
   */
  draftIndex(workspaceId: string): string {
    return `Comfy.Workflow.DraftIndex.v3:${workspaceId}`
  },

  /**
   * Individual draft payload key for localStorage.
   * @param path - Canonical workflow path
   */
  draftPayload(path: string, workspaceId: string): string {
    return `Comfy.Workflow.Draft.v3:${workspaceId}:${path}`
  },

  /**
   * Uses the complete canonical path as the collision-free draft identity.
   */
  draftKey(path: string): string {
    return path
  },

  /**
   * Active workflow pointer key for sessionStorage.
   * @param clientId - Browser tab identifier from api.clientId
   */
  activePath(clientId: string): string {
    return `Comfy.Workflow.ActivePath:${clientId}`
  },

  /**
   * Open workflows pointer key for sessionStorage.
   * @param clientId - Browser tab identifier from api.clientId
   */
  openPaths(clientId: string): string {
    return `Comfy.Workflow.OpenPaths:${clientId}`
  },

  /**
   * localStorage copies of tab pointers for cross-session restore.
   * sessionStorage is per-tab (correct for in-session use) but lost
   * on browser restart; these keys preserve the last-written state.
   */
  lastActivePath(workspaceId: string): string {
    return `Comfy.Workflow.LastActivePath:${workspaceId}`
  },

  lastOpenPaths(workspaceId: string): string {
    return `Comfy.Workflow.LastOpenPaths:${workspaceId}`
  },

  /**
   * Prefix patterns for cleanup operations.
   */
  prefixes: {
    draftIndex: 'Comfy.Workflow.DraftIndex.v3:',
    draftPayload: 'Comfy.Workflow.Draft.v3:',
    activePath: 'Comfy.Workflow.ActivePath:',
    openPaths: 'Comfy.Workflow.OpenPaths:',
    lastActivePath: 'Comfy.Workflow.LastActivePath:',
    lastOpenPaths: 'Comfy.Workflow.LastOpenPaths:'
  }
} as const
