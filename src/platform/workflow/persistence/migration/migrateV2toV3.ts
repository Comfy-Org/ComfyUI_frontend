/**
 * V2 to V3 draft migration.
 *
 * V2 used a 32-bit path hash for index and payload keys. V3 uses the complete
 * canonical path and stores it in both the index metadata and payload.
 */

import type {
  DraftEntryMeta,
  DraftIndexV2,
  DraftIndexV3,
  DraftPayloadV2
} from '../base/draftTypes'
import { createEmptyIndex } from '../base/draftCacheV2'
import { hashPath } from '../base/hashUtil'
import { getWorkspaceId } from '../base/storageKeys'
import {
  deletePayload,
  readIndex,
  writeIndex,
  writePayload
} from '../base/storageIO'

const v2IndexKey = (workspaceId: string) =>
  `Comfy.Workflow.DraftIndex.v2:${workspaceId}`
const v2PayloadPrefix = (workspaceId: string) =>
  `Comfy.Workflow.Draft.v2:${workspaceId}:`

export function hasV2DraftIndex(workspaceId: string): boolean {
  try {
    return localStorage.getItem(v2IndexKey(workspaceId)) !== null
  } catch {
    return false
  }
}

function isValidMeta(value: unknown): value is DraftEntryMeta {
  if (typeof value !== 'object' || value === null) return false
  const meta = value as Record<string, unknown>
  return (
    typeof meta.path === 'string' &&
    typeof meta.name === 'string' &&
    typeof meta.isTemporary === 'boolean' &&
    typeof meta.updatedAt === 'number'
  )
}

function parseV2Index(json: string): DraftIndexV2 | null {
  try {
    const value = JSON.parse(json) as Record<string, unknown>
    if (
      value.v !== 2 ||
      typeof value.updatedAt !== 'number' ||
      !Array.isArray(value.order) ||
      !value.order.every((key) => typeof key === 'string') ||
      new Set(value.order).size !== value.order.length ||
      typeof value.entries !== 'object' ||
      value.entries === null
    ) {
      return null
    }

    const order = value.order
    const orderKeys = new Set(order)
    const entries = value.entries as Record<string, unknown>

    const validEntries = Object.entries(entries).every(([key, entry]) => {
      return (
        orderKeys.has(key) && isValidMeta(entry) && hashPath(entry.path) === key
      )
    })

    return validEntries ? (value as unknown as DraftIndexV2) : null
  } catch {
    return null
  }
}

function readV2Payload(
  workspaceId: string,
  draftKey: string
): DraftPayloadV2 | null {
  try {
    const json = localStorage.getItem(
      `${v2PayloadPrefix(workspaceId)}${draftKey}`
    )
    if (!json) return null
    const value = JSON.parse(json) as Record<string, unknown>
    return typeof value.data === 'string' && typeof value.updatedAt === 'number'
      ? (value as unknown as DraftPayloadV2)
      : null
  } catch {
    return null
  }
}

function deleteV2Storage(workspaceId: string): void {
  const prefix = v2PayloadPrefix(workspaceId)
  try {
    localStorage.removeItem(v2IndexKey(workspaceId))
    for (let i = localStorage.length - 1; i >= 0; i--) {
      const key = localStorage.key(i)
      if (key?.startsWith(prefix)) localStorage.removeItem(key)
    }
  } catch {
    // V3 is already committed; stale V2 data is ignored on subsequent loads.
  }
}

function commitEmptyV3Index(workspaceId: string): number {
  return writeIndex(workspaceId, createEmptyIndex()) ? 0 : -1
}

function rollbackV3Payloads(workspaceId: string, paths: string[]): void {
  for (const path of paths) deletePayload(workspaceId, path)
}

/**
 * Migrates a V2 index and its payloads to V3.
 *
 * Any mismatched hash/path metadata or duplicate order key rejects the
 * complete V2 snapshot, because the canonical path of every draft can no
 * longer be trusted. Order keys with no entry and entries with a missing or
 * malformed payload are skipped instead: the V2 store treated that drift as
 * normal and healed it on load, so it must not cost the user their other
 * drafts. Nothing is written for a skipped entry.
 *
 * @returns Number of drafts migrated, or -1 if migration was not needed or
 * could not be committed.
 */
export function migrateV2toV3(workspaceId: string = getWorkspaceId()): number {
  if (readIndex(workspaceId)) return -1

  let rawIndex: string | null
  try {
    rawIndex = localStorage.getItem(v2IndexKey(workspaceId))
  } catch {
    return -1
  }
  if (!rawIndex) return -1

  const v2Index = parseV2Index(rawIndex)
  if (!v2Index) {
    console.warn('[V3 Migration] Discarded invalid V2 draft index')
    return commitEmptyV3Index(workspaceId)
  }

  const drafts: Array<{ meta: DraftEntryMeta; payload: DraftPayloadV2 }> = []
  for (const draftKey of v2Index.order) {
    const meta = v2Index.entries[draftKey]
    if (!meta) continue
    const payload = readV2Payload(workspaceId, draftKey)
    if (!payload) {
      console.warn(
        `[V3 Migration] Skipped V2 draft without payload: ${meta.path}`
      )
      continue
    }
    drafts.push({ meta, payload })
  }

  const v3Index: DraftIndexV3 = {
    v: 3,
    updatedAt: v2Index.updatedAt,
    order: drafts.map(({ meta }) => meta.path),
    entries: Object.fromEntries(drafts.map(({ meta }) => [meta.path, meta]))
  }
  const writtenPaths: string[] = []

  try {
    for (const { meta, payload } of drafts) {
      if (
        !writePayload(workspaceId, meta.path, {
          path: meta.path,
          data: payload.data,
          updatedAt: payload.updatedAt
        })
      ) {
        rollbackV3Payloads(workspaceId, writtenPaths)
        return -1
      }
      writtenPaths.push(meta.path)
    }

    if (!writeIndex(workspaceId, v3Index)) {
      rollbackV3Payloads(workspaceId, writtenPaths)
      return -1
    }
  } catch {
    rollbackV3Payloads(workspaceId, writtenPaths)
    return -1
  }

  deleteV2Storage(workspaceId)
  return v3Index.order.length
}
