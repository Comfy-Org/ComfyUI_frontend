import { WORKSPACE_STORAGE_KEYS } from '@/platform/workspace/workspaceConstants'

import { hashPath } from './hashUtil'

/**
 * Gets the current workspace ID from sessionStorage.
 * Returns 'personal' for personal workspace or when no workspace is set.
 */
function getCurrentWorkspaceId(): string {
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

// Cache workspace ID at module load (static for page lifetime, workspace switch reloads page)
const CURRENT_WORKSPACE_ID = getCurrentWorkspaceId()

/**
 * Returns the current workspace ID used for storage key scoping.
 */
export function getWorkspaceId(): string {
  return CURRENT_WORKSPACE_ID
}

/**
 * Storage key generators for V2 workflow persistence.
 *
 * localStorage keys are scoped by workspaceId.
 * sessionStorage keys are scoped by clientId.
 */
export const StorageKeys = {
  /**
   * Draft index key for localStorage.
   * Contains LRU order and metadata for all drafts.
   */
  draftIndex(workspaceId: string = CURRENT_WORKSPACE_ID): string {
    return `Comfy.Workflow.DraftIndex.v2:${workspaceId}`
  },

  /**
   * Individual draft payload key for localStorage.
   * @param path - Workflow path (will be hashed to create key)
   */
  draftPayload(
    path: string,
    workspaceId: string = CURRENT_WORKSPACE_ID
  ): string {
    const draftKey = hashPath(path)
    return `Comfy.Workflow.Draft.v2:${workspaceId}:${draftKey}`
  },

  /**
   * Creates a draft key (hash) from a workflow path.
   */
  draftKey(path: string): string {
    return hashPath(path)
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
   * Prefix patterns for cleanup operations.
   */
  prefixes: {
    draftIndex: 'Comfy.Workflow.DraftIndex.v2:',
    draftPayload: 'Comfy.Workflow.Draft.v2:',
    activePath: 'Comfy.Workflow.ActivePath:',
    openPaths: 'Comfy.Workflow.OpenPaths:'
  }
} as const
