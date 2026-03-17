/**
 * V1 to V2 Migration
 *
 * Migrates draft data from V1 blob format to V2 per-draft keys.
 * Runs once on first load if V2 index doesn't exist.
 * Keeps V1 data intact for rollback until 2026-07-15.
 */

import type { DraftIndexV2 } from '../base/draftTypes'
import { upsertEntry, createEmptyIndex } from '../base/draftCacheV2'
import { hashPath } from '../base/hashUtil'
import { getWorkspaceId } from '../base/storageKeys'
import {
  readIndex,
  writeIndex,
  writeOpenPaths,
  writePayload
} from '../base/storageIO'

/**
 * V1 draft snapshot structure (from draftCache.ts)
 */
interface V1DraftSnapshot {
  data: string
  updatedAt: number
  name: string
  isTemporary: boolean
}

/**
 * V1 storage keys - workspace-scoped blob format
 */
const V1_KEYS = {
  drafts: (workspaceId: string) => `Comfy.Workflow.Drafts:${workspaceId}`,
  order: (workspaceId: string) => `Comfy.Workflow.DraftOrder:${workspaceId}`,
  openPaths: 'Comfy.OpenWorkflowsPaths',
  activeIndex: 'Comfy.ActiveWorkflowIndex'
}

/**
 * Checks if V2 migration has been completed for the current workspace.
 */
export function isV2MigrationComplete(workspaceId: string): boolean {
  const v2Index = readIndex(workspaceId)
  return v2Index !== null
}

/**
 * Reads V1 drafts from localStorage.
 */
function readV1Drafts(
  workspaceId: string
): { drafts: Record<string, V1DraftSnapshot>; order: string[] } | null {
  try {
    const draftsJson = localStorage.getItem(V1_KEYS.drafts(workspaceId))
    const orderJson = localStorage.getItem(V1_KEYS.order(workspaceId))

    if (!draftsJson) return null

    const drafts = JSON.parse(draftsJson) as Record<string, V1DraftSnapshot>
    const order = orderJson ? (JSON.parse(orderJson) as string[]) : []

    return { drafts, order }
  } catch {
    return null
  }
}

/**
 * Migrates V1 drafts to V2 format.
 *
 * @returns Number of drafts migrated, or -1 if migration not needed/failed
 */
export function migrateV1toV2(
  workspaceId: string = getWorkspaceId(),
  clientId?: string
): number {
  // Check if V2 already exists
  if (isV2MigrationComplete(workspaceId)) {
    return -1
  }

  // Read V1 data
  const v1Data = readV1Drafts(workspaceId)
  if (!v1Data) {
    // No V1 data to migrate - create empty V2 index
    if (!writeIndex(workspaceId, createEmptyIndex())) return -1
    return 0
  }

  // Build V2 index and write payloads
  let index: DraftIndexV2 = createEmptyIndex()
  let migrated = 0

  // Process in order (oldest first) to maintain LRU order
  for (const path of v1Data.order) {
    const draft = v1Data.drafts[path]
    if (!draft) continue

    const draftKey = hashPath(path)

    // Write payload
    const payloadWritten = writePayload(workspaceId, draftKey, {
      data: draft.data,
      updatedAt: draft.updatedAt
    })

    if (!payloadWritten) {
      console.warn(`[V2 Migration] Failed to write payload for ${path}`)
      continue
    }

    // Update index
    const { index: newIndex } = upsertEntry(index, path, {
      name: draft.name,
      isTemporary: draft.isTemporary,
      updatedAt: draft.updatedAt
    })
    index = newIndex
    migrated++
  }

  // Write final index
  if (!writeIndex(workspaceId, index)) {
    console.error('[V2 Migration] Failed to write index')
    return -1
  }

  // Migrate V1 tab state pointers to V2 sessionStorage format.
  // V1 used setStorageValue which stored tab state in localStorage as fallback.
  // V2 uses sessionStorage keyed by clientId. Without this migration,
  // users upgrading from V1 lose their open tab list.
  migrateV1TabState(workspaceId, clientId)

  if (migrated > 0) {
    console.warn(`[V2 Migration] Migrated ${migrated} drafts from V1 to V2`)
  }
  return migrated
}

/**
 * Migrates V1 tab state (open paths + active index) to V2 format.
 * V1 stored these in localStorage via setStorageValue fallback.
 * V2 uses sessionStorage keyed by clientId.
 */
function migrateV1TabState(workspaceId: string, clientId?: string): void {
  if (!clientId) return

  try {
    const pathsJson = localStorage.getItem(V1_KEYS.openPaths)
    if (!pathsJson) return

    const paths = JSON.parse(pathsJson)
    if (!Array.isArray(paths) || paths.length === 0) return

    const indexJson = localStorage.getItem(V1_KEYS.activeIndex)
    let activeIndex = 0
    if (indexJson !== null) {
      const parsed = JSON.parse(indexJson)
      if (typeof parsed === 'number' && Number.isFinite(parsed)) {
        activeIndex = Math.min(Math.max(0, parsed), paths.length - 1)
      }
    }

    writeOpenPaths(clientId, { workspaceId, paths, activeIndex })
  } catch {
    // Best effort - don't block draft migration on tab state errors
  }
}

/**
 * Cleans up V1 data after successful migration.
 * Should NOT be called until 2026-07-15 to allow rollback.
 */
export function cleanupV1Data(workspaceId: string = getWorkspaceId()): void {
  try {
    localStorage.removeItem(V1_KEYS.drafts(workspaceId))
    localStorage.removeItem(V1_KEYS.order(workspaceId))
    console.warn('[V2 Migration] Cleaned up V1 data')
  } catch {
    // Ignore cleanup errors
  }
}

/**
 * Gets migration status for debugging.
 */
export function getMigrationStatus(workspaceId: string = getWorkspaceId()): {
  v1Exists: boolean
  v2Exists: boolean
  v1DraftCount: number
  v2DraftCount: number
} {
  const v1Data = readV1Drafts(workspaceId)
  const v2Index = readIndex(workspaceId)

  return {
    v1Exists: v1Data !== null,
    v2Exists: v2Index !== null,
    v1DraftCount: v1Data ? v1Data.order.length : 0,
    v2DraftCount: v2Index ? v2Index.order.length : 0
  }
}
