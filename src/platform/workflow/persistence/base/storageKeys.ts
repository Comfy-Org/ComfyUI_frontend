import { isCloud } from '@/platform/distribution/types'

import type { StorageScope } from './draftTypes'
import { hashPath } from './hashUtil'

export function resolveStorageScope(
  userId: string | null,
  workspaceId: string | null
): StorageScope | null {
  if (!isCloud) return 'personal' as StorageScope
  return userId && workspaceId
    ? (`cloud:${encodeURIComponent(userId)}:${encodeURIComponent(workspaceId)}` as StorageScope)
    : null
}

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
