/**
 * V1 to V2 Migration
 *
 * Migrates the legacy monolithic draft cache into V2 per-draft keys. The
 * original V1 store used unscoped `Comfy.Workflow.Drafts` / `DraftOrder`
 * keys. Early V2 migration code incorrectly looked only for workspace-scoped
 * variants, so this module also repairs installations where a V2 index already
 * exists while the real V1 blob is still present.
 */

import type { DraftIndexV2 } from '../base/draftTypes'
import { MAX_DRAFTS } from '../base/draftTypes'
import { createEmptyIndex } from '../base/draftCacheV2'
import { hashPath } from '../base/hashUtil'
import { getWorkspaceId } from '../base/storageKeys'
import {
  deletePayload,
  isStorageAvailable,
  readIndex,
  readOpenPaths,
  readPayload,
  readPersistentOpenPaths,
  writeIndex,
  writeOpenPaths,
  writePayload
} from '../base/storageIO'

interface V1DraftSnapshot {
  data: string
  updatedAt: number
  name: string
  isTemporary: boolean
}

interface V1StorageSource {
  draftsKey: string
  orderKey: string
  rawDrafts: string
  rawOrder: string | null
  drafts: Record<string, V1DraftSnapshot>
  order: string[]
  cleanupSafe: boolean
}

interface V1ReadResult {
  sources: V1StorageSource[]
  hasMalformedSource: boolean
}

interface RawStorageEntry {
  key: string
  value: string
}

type CommitResult = 'success' | 'quota' | 'blocked' | 'error'

const V1_KEYS = {
  drafts: 'Comfy.Workflow.Drafts',
  order: 'Comfy.Workflow.DraftOrder',
  scopedDrafts: (workspaceId: string) => `Comfy.Workflow.Drafts:${workspaceId}`,
  scopedOrder: (workspaceId: string) =>
    `Comfy.Workflow.DraftOrder:${workspaceId}`,
  openPaths: 'Comfy.OpenWorkflowsPaths',
  activeIndex: 'Comfy.ActiveWorkflowIndex'
}

function v1KeyPairs(workspaceId: string) {
  const scoped = {
    draftsKey: V1_KEYS.scopedDrafts(workspaceId),
    orderKey: V1_KEYS.scopedOrder(workspaceId)
  }

  // The real V1 cache was global. Only the personal workspace may adopt it;
  // using it for a team workspace would recreate the cross-workspace leak V2
  // was introduced to eliminate. Keep scoped-key support for interim builds.
  return workspaceId === 'personal'
    ? [{ draftsKey: V1_KEYS.drafts, orderKey: V1_KEYS.order }, scoped]
    : [scoped]
}

function isV1DraftSnapshot(value: unknown): value is V1DraftSnapshot {
  if (typeof value !== 'object' || value === null) return false
  const draft = value as Record<string, unknown>
  return (
    typeof draft.data === 'string' &&
    typeof draft.updatedAt === 'number' &&
    Number.isFinite(draft.updatedAt) &&
    typeof draft.name === 'string' &&
    typeof draft.isTemporary === 'boolean'
  )
}

function readV1Sources(workspaceId: string): V1ReadResult {
  const sources: V1StorageSource[] = []
  let hasMalformedSource = false

  for (const { draftsKey, orderKey } of v1KeyPairs(workspaceId)) {
    let rawDrafts: string | null
    let rawOrder: string | null
    try {
      rawDrafts = localStorage.getItem(draftsKey)
      if (rawDrafts === null) continue
      rawOrder = localStorage.getItem(orderKey)
    } catch {
      hasMalformedSource = true
      continue
    }

    try {
      const parsed = JSON.parse(rawDrafts) as unknown
      if (
        typeof parsed !== 'object' ||
        parsed === null ||
        Array.isArray(parsed)
      ) {
        hasMalformedSource = true
        continue
      }

      const drafts: Record<string, V1DraftSnapshot> = {}
      let cleanupSafe = true
      for (const [path, value] of Object.entries(
        parsed as Record<string, unknown>
      )) {
        if (!isV1DraftSnapshot(value)) {
          cleanupSafe = false
          continue
        }
        drafts[path] = value
      }

      let order: string[] = []
      if (rawOrder !== null) {
        try {
          const parsedOrder = JSON.parse(rawOrder) as unknown
          if (Array.isArray(parsedOrder)) {
            order = parsedOrder.filter(
              (path): path is string => typeof path === 'string'
            )
          }
        } catch {
          // Draft payloads are still recoverable without the old LRU order.
        }
      }

      sources.push({
        draftsKey,
        orderKey,
        rawDrafts,
        rawOrder,
        drafts,
        order,
        cleanupSafe
      })
    } catch {
      hasMalformedSource = true
    }
  }

  return { sources, hasMalformedSource }
}

function getV1Draft(
  drafts: Record<string, V1DraftSnapshot>,
  path: string
): V1DraftSnapshot | undefined {
  return drafts[path]
}

function getIndexEntry(
  index: DraftIndexV2,
  key: string
): DraftIndexV2['entries'][string] | undefined {
  return index.entries[key]
}

function mergedV1Data(sources: V1StorageSource[]): {
  drafts: Record<string, V1DraftSnapshot>
  order: string[]
} {
  const drafts: Record<string, V1DraftSnapshot> = {}
  let order: string[] = []

  for (const source of sources) {
    const inOrder = new Set<string>()
    const sourceOrder: string[] = []

    for (const path of source.order) {
      const draft = getV1Draft(source.drafts, path)
      if (!draft || inOrder.has(path)) continue
      inOrder.add(path)
      sourceOrder.push(path)
    }

    const unordered = Object.keys(source.drafts)
      .filter((path) => !inOrder.has(path))
      .sort(
        (a, b) =>
          source.drafts[a].updatedAt - source.drafts[b].updatedAt ||
          a.localeCompare(b)
      )

    for (const path of [...sourceOrder, ...unordered]) {
      const candidate = getV1Draft(source.drafts, path)
      if (!candidate) continue
      const previous = getV1Draft(drafts, path)
      if (!previous || candidate.updatedAt >= previous.updatedAt) {
        drafts[path] = candidate
      }

      // Later sources/order occurrences are treated as more recent, matching
      // the V1 touch-order semantics.
      order = order.filter((entry) => entry !== path)
      order.push(path)
    }
  }

  return { drafts, order }
}

function hasLegacyDraftStorage(workspaceId: string): boolean {
  try {
    return v1KeyPairs(workspaceId).some(
      ({ draftsKey }) => localStorage.getItem(draftsKey) !== null
    )
  } catch {
    return false
  }
}

/**
 * Migration is complete only when a V2 index exists and no relevant V1 draft
 * blob remains. This lets current builds repair the previously-created empty
 * V2 index instead of treating it as a permanent migration marker.
 */
export function isV2MigrationComplete(workspaceId: string): boolean {
  return readIndex(workspaceId) !== null && !hasLegacyDraftStorage(workspaceId)
}

function orderedIndexKeys(index: DraftIndexV2): string[] {
  const seen = new Set<string>()
  const ordered: string[] = []

  for (const key of index.order) {
    if (!getIndexEntry(index, key) || seen.has(key)) continue
    seen.add(key)
    ordered.push(key)
  }

  const missingFromOrder = Object.keys(index.entries)
    .filter((key) => !seen.has(key))
    .sort(
      (a, b) =>
        index.entries[a].updatedAt - index.entries[b].updatedAt ||
        a.localeCompare(b)
    )

  return [...ordered, ...missingFromOrder]
}

function commitV2Recovery(
  workspaceId: string,
  finalIndex: DraftIndexV2,
  payloadsToWrite: Map<string, V1DraftSnapshot>
): CommitResult {
  // The workspace-transition fence deliberately makes write helpers return
  // false. Treating that as quota would temporarily delete legacy recovery
  // data in an attempt to free space even though no write can succeed.
  if (!isStorageAvailable()) return 'blocked'

  const newlyWritten: string[] = []
  const rollbackPayloadWrites = () => {
    for (const writtenKey of newlyWritten) {
      deletePayload(workspaceId, writtenKey)
    }
  }
  const writeFailure = (): CommitResult =>
    isStorageAvailable() ? 'quota' : 'blocked'

  try {
    for (const [draftKey, draft] of payloadsToWrite) {
      if (
        !writePayload(workspaceId, draftKey, {
          data: draft.data,
          updatedAt: draft.updatedAt
        })
      ) {
        rollbackPayloadWrites()
        return writeFailure()
      }
      newlyWritten.push(draftKey)
    }

    if (!writeIndex(workspaceId, finalIndex)) {
      rollbackPayloadWrites()
      return writeFailure()
    }

    return 'success'
  } catch (error) {
    rollbackPayloadWrites()
    console.warn('[V2 Migration] Failed to commit recovered draft data', error)
    return 'error'
  }
}

function sourceStorageEntries(source: V1StorageSource): RawStorageEntry[] {
  const entries: RawStorageEntry[] = [
    { key: source.draftsKey, value: source.rawDrafts }
  ]
  if (source.rawOrder !== null) {
    entries.push({ key: source.orderKey, value: source.rawOrder })
  }
  return entries
}

function restoreRawEntries(entries: RawStorageEntry[]): boolean {
  let restored = true
  for (const entry of entries) {
    try {
      localStorage.setItem(entry.key, entry.value)
    } catch (error) {
      restored = false
      console.error(
        `[V2 Migration] Failed to restore legacy storage key ${entry.key}`,
        error
      )
    }
  }
  return restored
}

function removeRawEntriesForRetry(
  entries: RawStorageEntry[]
): RawStorageEntry[] | null {
  const removed: RawStorageEntry[] = []
  for (const entry of entries) {
    try {
      localStorage.removeItem(entry.key)
      if (localStorage.getItem(entry.key) !== null) {
        restoreRawEntries(removed)
        console.warn(
          `[V2 Migration] Could not free legacy storage for quota recovery: legacy storage key ${entry.key} was not removed`
        )
        return null
      }
    } catch (error) {
      restoreRawEntries(removed)
      console.warn(
        '[V2 Migration] Could not free legacy storage for quota recovery',
        error
      )
      return null
    }
    removed.push(entry)
  }
  return removed
}

function removeRawEntriesBestEffort(entries: RawStorageEntry[]): void {
  for (const entry of entries) {
    try {
      localStorage.removeItem(entry.key)
    } catch (error) {
      console.warn(
        `[V2 Migration] Could not clean legacy storage key ${entry.key}`,
        error
      )
    }
  }
}

function redundantLegacyWorkflowEntry(
  workspaceId: string,
  finalIndex: DraftIndexV2,
  payloadsToWrite: Map<string, V1DraftSnapshot>
): RawStorageEntry | null {
  if (workspaceId !== 'personal') return null

  let legacyWorkflow: string | null
  try {
    legacyWorkflow = localStorage.getItem('workflow')
  } catch {
    return null
  }
  if (legacyWorkflow === null) return null

  for (const draftKey of finalIndex.order) {
    // Staged migration payloads are already available as parsed snapshots.
    // Check them before touching localStorage so quota-recovery candidates do
    // not get parsed again during the legacy-singleton redundancy scan.
    const pendingPayload = payloadsToWrite.get(draftKey)
    if (pendingPayload) {
      if (pendingPayload.data === legacyWorkflow) {
        return { key: 'workflow', value: legacyWorkflow }
      }
      continue
    }

    const currentPayload = readPayload(workspaceId, draftKey)
    if (currentPayload?.data === legacyWorkflow) {
      return { key: 'workflow', value: legacyWorkflow }
    }
  }
  return null
}

function hasPersistentOpenPaths(
  workspaceId: string,
  expectedPaths: string[]
): boolean {
  const pointer = readPersistentOpenPaths(workspaceId)
  return (
    pointer !== null &&
    pointer.workspaceId === workspaceId &&
    pointer.paths.length === expectedPaths.length &&
    pointer.paths.every((path, index) => path === expectedPaths[index])
  )
}

function migrateV1TabState(workspaceId: string, clientId?: string): boolean {
  if (workspaceId !== 'personal' || !clientId) return false

  try {
    const current = readOpenPaths(clientId, workspaceId)
    if (current?.paths.length) {
      // Older V2 builds may have only the session-scoped copy. Refresh it and
      // require the durable local fallback before deleting the V1 pointer.
      writeOpenPaths(clientId, current)
      return hasPersistentOpenPaths(workspaceId, current.paths)
    }

    const pathsJson = localStorage.getItem(V1_KEYS.openPaths)
    if (!pathsJson) return true

    const parsedPaths = JSON.parse(pathsJson) as unknown
    if (!Array.isArray(parsedPaths)) return false
    const paths = parsedPaths.filter(
      (path): path is string => typeof path === 'string'
    )
    if (paths.length === 0) return true

    const indexJson = localStorage.getItem(V1_KEYS.activeIndex)
    let activeIndex = 0
    if (indexJson !== null) {
      const parsedIndex = JSON.parse(indexJson) as unknown
      if (typeof parsedIndex === 'number' && Number.isFinite(parsedIndex)) {
        activeIndex = Math.min(Math.max(0, parsedIndex), paths.length - 1)
      }
    }

    writeOpenPaths(clientId, { workspaceId, paths, activeIndex })
    return hasPersistentOpenPaths(workspaceId, paths)
  } catch {
    return false
  }
}

function migrateAndCleanupV1TabState(
  workspaceId: string,
  clientId?: string
): void {
  if (workspaceId !== 'personal') return
  if (!migrateV1TabState(workspaceId, clientId)) return

  try {
    localStorage.removeItem(V1_KEYS.openPaths)
    localStorage.removeItem(V1_KEYS.activeIndex)
  } catch {
    // Best effort. Leaving tiny legacy pointers is safe.
  }
}

/**
 * Migrates or repairs V1 drafts into V2.
 *
 * Existing V2 payloads always win. A V1 payload is used only for a legacy-only
 * path or to repair a V2 index entry whose payload was lost. If quota prevents
 * the repair while the legacy monolithic blob is still present, cleanly parsed
 * V1 sources are temporarily removed and the transaction is retried; they are
 * restored if the V2 commit still fails.
 *
 * @returns Number of V1 payloads recovered into V2, 0 for an empty migration,
 * or -1 for a non-mutating outcome. The -1 result intentionally covers both a
 * healthy no-op and a preserved-data recovery failure: the only current caller
 * needs to know whether V2 storage changed so it can invalidate its cache.
 * Failed recovery keeps legacy data in place and is retried on the next
 * persistence initialization.
 */
export function migrateV1toV2(
  workspaceId: string = getWorkspaceId(),
  clientId?: string
): number {
  const originalIndex = readIndex(workspaceId)
  const { sources, hasMalformedSource } = readV1Sources(workspaceId)

  if (sources.length === 0) {
    if (hasMalformedSource) return -1
    if (originalIndex) {
      const redundantWorkflow = redundantLegacyWorkflowEntry(
        workspaceId,
        originalIndex,
        new Map()
      )
      if (redundantWorkflow) {
        removeRawEntriesBestEffort([redundantWorkflow])
      }
      migrateAndCleanupV1TabState(workspaceId, clientId)
      return -1
    }

    if (!writeIndex(workspaceId, createEmptyIndex())) return -1
    migrateAndCleanupV1TabState(workspaceId, clientId)
    return 0
  }

  const legacy = mergedV1Data(sources)
  const baseIndex = originalIndex ?? createEmptyIndex()
  const legacyByKey = new Map<
    string,
    { path: string; draft: V1DraftSnapshot }
  >()
  let hasHashCollision = false

  const draftsByPath: Partial<Record<string, V1DraftSnapshot>> = legacy.drafts
  for (const path of legacy.order) {
    const draft = draftsByPath[path]
    if (!draft) continue

    const draftKey = hashPath(path)
    const previous = legacyByKey.get(draftKey)
    if (previous && previous.path !== path) {
      hasHashCollision = true
      console.warn(
        `[V2 Migration] Draft-key collision between ${previous.path} and ${path}`
      )
      continue
    }
    legacyByKey.set(draftKey, { path, draft })
  }

  for (const path of legacy.order) {
    const draftKey = hashPath(path)
    const previous = legacyByKey.get(draftKey)
    if (previous && previous.path !== path) {
      hasHashCollision = true
      console.warn(
        `[V2 Migration] Draft-key collision between ${previous.path} and ${path}`
      )
      continue
    }
    legacyByKey.set(draftKey, { path, draft: legacy.drafts[path] })
  }

  const existingKeys: string[] = []
  const existingSet = new Set<string>()
  const payloadsToWrite = new Map<string, V1DraftSnapshot>()

  for (const draftKey of orderedIndexKeys(baseIndex)) {
    const entry = baseIndex.entries[draftKey]
    const currentPayload = readPayload(workspaceId, draftKey)
    const legacyEntry = legacyByKey.get(draftKey)
    const recoverableLegacy =
      legacyEntry && legacyEntry.path === entry.path ? legacyEntry.draft : null

    if (!currentPayload && !recoverableLegacy) continue

    existingKeys.push(draftKey)
    existingSet.add(draftKey)
    if (!currentPayload && recoverableLegacy) {
      payloadsToWrite.set(draftKey, recoverableLegacy)
    }
  }

  // Preserve every currently recoverable V2 entry first. Legacy-only entries
  // fill the remaining retention slots from newest to oldest.
  const retainedExisting = existingKeys.slice(-MAX_DRAFTS)
  const retainedExistingSet = new Set(retainedExisting)
  const legacyOnlyKeys: string[] = []

  for (const path of legacy.order) {
    const draftKey = hashPath(path)
    const legacyEntry = legacyByKey.get(draftKey)
    if (!legacyEntry || legacyEntry.path !== path) continue

    const currentEntry = getIndexEntry(baseIndex, draftKey)
    if (currentEntry) {
      if (currentEntry.path !== path) hasHashCollision = true
      continue
    }
    if (existingSet.has(draftKey) || legacyOnlyKeys.includes(draftKey)) continue
    legacyOnlyKeys.push(draftKey)
  }

  const legacyCapacity = Math.max(0, MAX_DRAFTS - retainedExisting.length)
  const retainedLegacy =
    legacyCapacity > 0 ? legacyOnlyKeys.slice(-legacyCapacity) : []
  const finalOrder = [...retainedLegacy, ...retainedExisting]
  const finalEntries: DraftIndexV2['entries'] = {}

  for (const draftKey of finalOrder) {
    const currentEntry = getIndexEntry(baseIndex, draftKey)
    if (currentEntry) {
      finalEntries[draftKey] = currentEntry
      continue
    }

    const legacyEntry = legacyByKey.get(draftKey)
    if (!legacyEntry) continue
    finalEntries[draftKey] = {
      path: legacyEntry.path,
      name: legacyEntry.draft.name,
      isTemporary: legacyEntry.draft.isTemporary,
      updatedAt: legacyEntry.draft.updatedAt
    }
    // A V2 payload can survive after its index entry was lost. Re-index that
    // newer payload instead of overwriting it with an older V1 copy.
    if (!readPayload(workspaceId, draftKey)) {
      payloadsToWrite.set(draftKey, legacyEntry.draft)
    }
  }

  // A retained-existing slice can discard only an already-invalid over-limit
  // index. Never write payloads for entries that are not part of the commit.
  for (const draftKey of [...payloadsToWrite.keys()]) {
    if (
      !retainedExistingSet.has(draftKey) &&
      !retainedLegacy.includes(draftKey)
    ) {
      payloadsToWrite.delete(draftKey)
    }
  }

  const finalIndex: DraftIndexV2 = {
    v: 2,
    updatedAt: Date.now(),
    order: finalOrder,
    entries: finalEntries
  }

  let commitResult = commitV2Recovery(workspaceId, finalIndex, payloadsToWrite)
  const removableSources = hasHashCollision
    ? []
    : sources.filter((source) => source.cleanupSafe)
  const cleanupEntries = removableSources.flatMap(sourceStorageEntries)
  const redundantWorkflow = redundantLegacyWorkflowEntry(
    workspaceId,
    finalIndex,
    payloadsToWrite
  )
  if (redundantWorkflow) cleanupEntries.push(redundantWorkflow)
  let removedForRetry = false

  if (commitResult === 'quota' && cleanupEntries.length > 0) {
    // The old monolithic draft blob and legacy singleton can consume most of
    // the origin's localStorage quota. Remove only data that is either fully
    // parsed or byte-for-byte redundant, then retry the V2 commit.
    const removedEntries = removeRawEntriesForRetry(cleanupEntries)
    if (!removedEntries) return -1

    removedForRetry = true
    commitResult = commitV2Recovery(workspaceId, finalIndex, payloadsToWrite)
    if (commitResult !== 'success') {
      restoreRawEntries(removedEntries)
      return -1
    }
  }

  if (commitResult !== 'success') return -1

  if (!removedForRetry) {
    removeRawEntriesBestEffort(cleanupEntries)
  }

  migrateAndCleanupV1TabState(workspaceId, clientId)

  if (hasHashCollision || sources.some((source) => !source.cleanupSafe)) {
    console.warn(
      '[V2 Migration] Some legacy data was left intact because it could not be safely cleaned'
    )
  }

  const migrated = payloadsToWrite.size
  if (migrated > 0) {
    console.warn(`[V2 Migration] Recovered ${migrated} legacy draft(s) into V2`)
  }
  return migrated
}

/**
 * Removes legacy workflow persistence keys for a workspace. The unscoped V1
 * keys belong to the personal workspace only.
 */
export function cleanupV1Data(workspaceId: string = getWorkspaceId()): void {
  try {
    for (const { draftsKey, orderKey } of v1KeyPairs(workspaceId)) {
      localStorage.removeItem(draftsKey)
      localStorage.removeItem(orderKey)
    }
    if (workspaceId === 'personal') {
      localStorage.removeItem(V1_KEYS.openPaths)
      localStorage.removeItem(V1_KEYS.activeIndex)
    }
  } catch {
    // Ignore cleanup errors.
  }
}

export function getMigrationStatus(workspaceId: string = getWorkspaceId()): {
  v1Exists: boolean
  v2Exists: boolean
  v1DraftCount: number
  v2DraftCount: number
} {
  const { sources } = readV1Sources(workspaceId)
  const v1Data = mergedV1Data(sources)
  const v2Index = readIndex(workspaceId)

  return {
    v1Exists: hasLegacyDraftStorage(workspaceId),
    v2Exists: v2Index !== null,
    v1DraftCount: v1Data.order.length,
    v2DraftCount: v2Index ? v2Index.order.length : 0
  }
}
