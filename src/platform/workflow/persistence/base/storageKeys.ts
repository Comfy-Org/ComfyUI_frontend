import { WORKSPACE_STORAGE_KEYS } from '@/platform/workspace/workspaceConstants'
import { isCloud } from '@/platform/distribution/types'

import { hashPath } from './hashUtil'

/**
 * A resolved localStorage scope: `${userId}:${workspaceId}` on cloud,
 * `personal` elsewhere. Branded so the type checker can tell it apart from a
 * bare workspace id, which is the substitution that caused the collision this
 * scope exists to prevent. Only {@link resolveStorageScope} can mint one.
 */
export type StorageScope = string & { readonly __storageScope: unique symbol }

/**
 * Reads the current workspace ID from sessionStorage.
 * Returns 'personal' outside cloud or for the personal workspace, and null
 * while the cloud workspace is unresolved.
 *
 * Returning null rather than defaulting to 'personal' is the point: a cloud
 * session whose workspace has not loaded yet has no scope, and writing under
 * 'personal' would put one workspace's drafts in another's namespace.
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

    const parsed: unknown = JSON.parse(json)
    if (typeof parsed !== 'object' || parsed === null) return null
    if ('type' in parsed && parsed.type === 'personal') return 'personal'
    return 'id' in parsed && typeof parsed.id === 'string' && parsed.id
      ? parsed.id
      : null
  } catch {
    return null
  }
}

/**
 * Resolves the localStorage scope for per-user persisted state.
 *
 * Cloud state belongs to one user in one workspace, so the scope is
 * `${userId}:${workspaceId}` and is unresolvable until both are known. Callers
 * must treat null as "do not write yet" rather than substituting a default:
 * a workspace-only scope collides two identities inside one team workspace and
 * the last write wins, which is how a user loses work they saved.
 */
export function resolveStorageScope(
  userId: string | null,
  workspaceId: string | null
): StorageScope | null {
  if (!isCloud) return 'personal' as StorageScope
  return userId && workspaceId
    ? (`${userId}:${workspaceId}` as StorageScope)
    : null
}

/**
 * Storage key generators for V2 workflow persistence and agent session state.
 *
 * localStorage keys are scoped by storage scope (`${userId}:${workspaceId}` on
 * cloud, `personal` elsewhere). sessionStorage keys are scoped by clientId.
 */
export const StorageKeys = {
  /**
   * Draft index key for localStorage.
   * Contains LRU order and metadata for all drafts.
   */
  draftIndex(scope: StorageScope): string {
    return `Comfy.Workflow.DraftIndex.v2:${scope}`
  },

  /**
   * Individual draft payload key for localStorage.
   * @param path - Workflow path (will be hashed to create key)
   */
  draftPayload(path: string, scope: StorageScope): string {
    const draftKey = hashPath(path)
    return `Comfy.Workflow.Draft.v2:${scope}:${draftKey}`
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
   * Agent session state, scoped by storage scope like the draft keys.
   * See ADR WORKFLOW-PERSISTENCE-0031 for the ownership rationale.
   */
  agentThread(scope: StorageScope): string {
    return `Comfy.Agent.ThreadId:${scope}`
  },

  agentWorkflowTabBindings(scope: StorageScope): string {
    return `Comfy.Agent.WorkflowTabBindings:${scope}`
  },

  agentChatTitles(scope: StorageScope): string {
    return `Comfy.Agent.ChatTitles:${scope}`
  },

  agentDeletedThreads(scope: StorageScope): string {
    return `Comfy.Agent.DeletedThreads:${scope}`
  },

  /**
   * localStorage copies of tab pointers for cross-session restore.
   * sessionStorage is per-tab (correct for in-session use) but lost
   * on browser restart; these keys preserve the last-written state.
   */
  lastActivePath(scope: StorageScope): string {
    return `Comfy.Workflow.LastActivePath:${scope}`
  },

  lastOpenPaths(scope: StorageScope): string {
    return `Comfy.Workflow.LastOpenPaths:${scope}`
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
    lastOpenPaths: 'Comfy.Workflow.LastOpenPaths:',
    agentThread: 'Comfy.Agent.ThreadId:',
    agentWorkflowTabBindings: 'Comfy.Agent.WorkflowTabBindings:',
    agentChatTitles: 'Comfy.Agent.ChatTitles:',
    agentDeletedThreads: 'Comfy.Agent.DeletedThreads:'
  }
} as const
