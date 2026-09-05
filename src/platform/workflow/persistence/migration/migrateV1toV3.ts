/**
 * V1 to V3 Migration
 *
 * Migrates draft data from V1 blob format to V3 per-draft keys.
 * Runs once on first load if the V3 index doesn't exist.
 */

import type { DraftIndexV3 } from '../base/draftTypes'
import { upsertEntry, createEmptyIndex } from '../base/draftCacheV2'
import { getWorkspaceId } from '../base/storageKeys'
import { hasV2DraftIndex } from './migrateV2toV3'
import {
  readIndex,
  writeIndex,
  writeOpenPaths,
  writePayload
} from '../base/storageIO'

/**
 * Legacy V1 draft snapshot structure.
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
 * Checks if V3 migration has been completed for the current workspace.
 */
export function isV3MigrationComplete(workspaceId: string): boolean {
  const v3Index = readIndex(workspaceId)
  return v3Index !== null
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
 * Migrates V1 drafts to V3 format.
 *
 * @returns Number of drafts migrated, or -1 if migration not needed/failed
 */
export function migrateV1toV3(
  workspaceId: string = getWorkspaceId(),
  clientId?: string
): number {
  // V3 already exists, or a V2 index supersedes the V1 blob. V1 keys were
  // never removed by the V1 to V2 migration, so falling through here after a
  // transient V2 to V3 failure would resurrect stale V1 drafts over V2 ones.
  if (isV3MigrationComplete(workspaceId) || hasV2DraftIndex(workspaceId)) {
    return -1
  }

  // Read V1 data
  const v1Data = readV1Drafts(workspaceId)
  if (!v1Data) {
    // No V1 data to migrate - create empty V3 index
    if (!writeIndex(workspaceId, createEmptyIndex())) return -1
    return 0
  }

  // Build V3 index and write payloads
  let index: DraftIndexV3 = createEmptyIndex()
  let migrated = 0

  // Process in order (oldest first) to maintain LRU order
  const draftsByPath: Partial<Record<string, V1DraftSnapshot>> = v1Data.drafts
  for (const path of v1Data.order) {
    const draft = draftsByPath[path]
    if (!draft) continue

    // Write payload
    const payloadWritten = writePayload(workspaceId, path, {
      path,
      data: draft.data,
      updatedAt: draft.updatedAt
    })

    if (!payloadWritten) {
      console.warn(`[V3 Migration] Failed to write payload for ${path}`)
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
    console.error('[V3 Migration] Failed to write index')
    return -1
  }

  // Migrate V1 tab state pointers to the current sessionStorage format.
  // V1 used setStorageValue which stored tab state in localStorage as fallback.
  // The current format uses sessionStorage keyed by clientId. Without this migration,
  // users upgrading from V1 lose their open tab list.
  migrateV1TabState(workspaceId, clientId)

  if (migrated > 0) {
    console.warn(`[V3 Migration] Migrated ${migrated} drafts from V1 to V3`)
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
