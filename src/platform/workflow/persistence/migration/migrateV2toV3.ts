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
    const entries = value.entries as Record<string, unknown>
    const entryKeys = Object.keys(entries)
    if (entryKeys.length !== order.length) return null

    const validEntries = entryKeys.every((key) => {
      const entry = entries[key]
      return (
        order.includes(key) &&
        isValidMeta(entry) &&
        hashPath(entry.path) === key
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
 * Migrates a structurally consistent V2 index and all of its payloads.
 *
 * Any mismatched hash/path metadata, duplicate order key, missing payload, or
 * malformed payload rejects the complete V2 snapshot. This avoids attaching
 * unverifiable payload data to a canonical path.
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

  const payloads = new Map<string, DraftPayloadV2>()
  for (const draftKey of v2Index.order) {
    const payload = readV2Payload(workspaceId, draftKey)
    if (!payload) {
      console.warn('[V3 Migration] Discarded incomplete V2 draft snapshot')
      return commitEmptyV3Index(workspaceId)
    }
    payloads.set(draftKey, payload)
  }

  const v3Index: DraftIndexV3 = {
    v: 3,
    updatedAt: v2Index.updatedAt,
    order: v2Index.order.map((key) => v2Index.entries[key].path),
    entries: Object.fromEntries(
      v2Index.order.map((key) => {
        const entry = v2Index.entries[key]
        return [entry.path, entry]
      })
    )
  }
  const writtenPaths: string[] = []

  try {
    for (const draftKey of v2Index.order) {
      const path = v2Index.entries[draftKey].path
      const payload = payloads.get(draftKey)!
      if (
        !writePayload(workspaceId, path, {
          path,
          data: payload.data,
          updatedAt: payload.updatedAt
        })
      ) {
        rollbackV3Payloads(workspaceId, writtenPaths)
        return -1
      }
      writtenPaths.push(path)
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
