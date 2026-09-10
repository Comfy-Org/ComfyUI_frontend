import { WORKSPACE_STORAGE_KEYS } from '@/platform/workspace/workspaceConstants'
import { isCloud } from '@/platform/distribution/types'

import { hashPath } from './hashUtil'

/**
 * Reads the current workspace ID from sessionStorage.
 * Returns 'personal' outside cloud or for the personal workspace, and null
 * while the cloud workspace is unresolved.
 *
 * NOTE: This is called fresh each time rather than cached at module load,
 * because the workspace auth store may not have set sessionStorage yet
 * when this module is first imported.
 */
export function readWorkspaceId(): string | null {
  if (!isCloud) return 'personal'

  try {
    const json = sessionStorage.getItem(
      WORKSPACE_STORAGE_KEYS.CURRENT_WORKSPACE
    )
    if (!json) return null

    const workspace = JSON.parse(json)
    if (workspace.type === 'personal') return 'personal'
    return typeof workspace.id === 'string' && workspace.id
      ? workspace.id
      : null
  } catch {
    return null
  }
}

/**
 * Gets the current workspace ID, falling back to 'personal' when unresolved.
 */
export function getWorkspaceId(): string {
  return readWorkspaceId() ?? 'personal'
}

/**
 * Resolves the localStorage scope for workflow drafts.
 * Cloud drafts belong to one user in one workspace, so the scope is
 * `${userId}:${workspaceId}` and unresolvable until both are known.
 */
export function resolveStorageScope(
  userId: string | null,
  workspaceId: string | null
): string | null {
  if (!isCloud) return 'personal'
  return userId && workspaceId ? `${userId}:${workspaceId}` : null
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
  draftIndex(workspaceId: string): string {
    return `Comfy.Workflow.DraftIndex.v2:${workspaceId}`
  },

  /**
   * Individual draft payload key for localStorage.
   * @param path - Workflow path (will be hashed to create key)
   */
  draftPayload(path: string, workspaceId: string): string {
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
    draftIndex: 'Comfy.Workflow.DraftIndex.v2:',
    draftPayload: 'Comfy.Workflow.Draft.v2:',
    activePath: 'Comfy.Workflow.ActivePath:',
    openPaths: 'Comfy.Workflow.OpenPaths:',
    lastActivePath: 'Comfy.Workflow.LastActivePath:',
    lastOpenPaths: 'Comfy.Workflow.LastOpenPaths:'
  }
} as const
