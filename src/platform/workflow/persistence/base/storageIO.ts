/**
 * V2 Storage I/O - localStorage read/write with error handling.
 *
 * Handles quota management, orphan cleanup, and graceful degradation.
 */

import type {
  ActivePathPointer,
  DraftIndexV2,
  DraftPayloadV2,
  OpenPathsPointer
} from './draftTypes'
import { StorageKeys } from './storageKeys'

type StorageAvailability = 'available' | 'unavailable'
type WorkflowStorageState =
  | { status: 'ready'; availability: StorageAvailability }
  | {
      status: 'transitioning'
      reason: 'workspace'
      resumeAvailability: StorageAvailability
      ownerId: symbol
    }
  | {
      status: 'transitioning'
      reason: 'logout'
      resumeAvailability: StorageAvailability
    }

let workflowStorageState: WorkflowStorageState = {
  status: 'ready',
  availability: 'available'
}
const pendingPersistenceFlushes = new Set<() => void>()

export function registerWorkflowPersistenceFlush(
  flush: () => void
): () => void {
  pendingPersistenceFlushes.add(flush)
  return () => pendingPersistenceFlushes.delete(flush)
}

function flushPendingWorkflowPersistence(): void {
  for (const flush of pendingPersistenceFlushes) {
    try {
      flush()
    } catch (error) {
      console.warn('Failed to flush pending workflow persistence', error)
    }
  }
}

export function isStorageAvailable(): boolean {
  return (
    workflowStorageState.status === 'ready' &&
    workflowStorageState.availability === 'available'
  )
}

export function markStorageUnavailable(): void {
  workflowStorageState =
    workflowStorageState.status === 'transitioning'
      ? { ...workflowStorageState, resumeAvailability: 'unavailable' }
      : { status: 'ready', availability: 'unavailable' }
}

function isStorageReadable(): boolean {
  return workflowStorageState.status === 'transitioning'
    ? workflowStorageState.resumeAvailability === 'available'
    : workflowStorageState.availability === 'available'
}

/** @internal Test-only: do not call from production code paths. */
export function resetStorageAvailable(): void {
  workflowStorageState = { status: 'ready', availability: 'available' }
}

function isQuotaExceeded(error: unknown): boolean {
  return (
    error instanceof DOMException &&
    (error.name === 'QuotaExceededError' ||
      error.name === 'NS_ERROR_DOM_QUOTA_REACHED' ||
      error.code === 22 ||
      error.code === 1014)
  )
}

type PersistedDraftIndexV2 = Omit<DraftIndexV2, 'order' | 'entries'> & {
  order: unknown[]
  entries: Record<string, unknown>
}

function isValidIndex(value: unknown): value is PersistedDraftIndexV2 {
  if (typeof value !== 'object' || value === null) return false
  const obj = value as Record<string, unknown>
  return (
    obj.v === 2 &&
    typeof obj.updatedAt === 'number' &&
    Array.isArray(obj.order) &&
    typeof obj.entries === 'object' &&
    obj.entries !== null
  )
}

function isValidPayload(value: unknown): value is DraftPayloadV2 {
  if (typeof value !== 'object' || value === null) return false
  const obj = value as Record<string, unknown>
  return (
    typeof obj.data === 'string' &&
    typeof obj.updatedAt === 'number' &&
    Number.isFinite(obj.updatedAt)
  )
}

function sanitizeIndexEntries(index: PersistedDraftIndexV2): DraftIndexV2 {
  const entries: DraftIndexV2['entries'] = {}

  for (const [draftKey, entry] of Object.entries(index.entries)) {
    if (typeof entry !== 'object' || entry === null) continue

    const value = entry as unknown as Record<string, unknown>
    if (
      typeof value.path !== 'string' ||
      value.path.length === 0 ||
      typeof value.name !== 'string' ||
      typeof value.isTemporary !== 'boolean' ||
      typeof value.updatedAt !== 'number' ||
      !Number.isFinite(value.updatedAt)
    ) {
      continue
    }

    const normalized = { ...value }
    if (
      'isModified' in normalized &&
      typeof normalized.isModified !== 'boolean'
    ) {
      delete normalized.isModified
    }
    entries[draftKey] = normalized as unknown as DraftIndexV2['entries'][string]
  }

  const seen = new Set<string>()
  const order = index.order.filter((draftKey): draftKey is string => {
    if (
      typeof draftKey !== 'string' ||
      !(draftKey in entries) ||
      seen.has(draftKey)
    ) {
      return false
    }
    seen.add(draftKey)
    return true
  })

  return { ...index, order, entries }
}

/**
 * Reads and parses the draft index from localStorage.
 */
export function readIndex(workspaceId: string): DraftIndexV2 | null {
  if (!isStorageReadable()) return null

  try {
    const key = StorageKeys.draftIndex(workspaceId)
    const json = localStorage.getItem(key)
    if (!json) return null

    const parsed = JSON.parse(json)
    if (!isValidIndex(parsed)) return null

    return sanitizeIndexEntries(parsed)
  } catch {
    return null
  }
}

/**
 * Writes the draft index to localStorage.
 */
export function writeIndex(workspaceId: string, index: DraftIndexV2): boolean {
  if (!isStorageAvailable()) return false

  try {
    const key = StorageKeys.draftIndex(workspaceId)
    localStorage.setItem(key, JSON.stringify(index))
    return true
  } catch (error) {
    if (isQuotaExceeded(error)) return false
    throw error
  }
}

function draftPayloadStorageKey(workspaceId: string, draftKey: string): string {
  return `${StorageKeys.prefixes.draftPayload}${workspaceId}:${draftKey}`
}

/** Reads the exact serialized draft payload without parsing workflow data. */
export function readPayloadRaw(
  workspaceId: string,
  draftKey: string
): string | null {
  if (!isStorageReadable()) return null

  try {
    return localStorage.getItem(draftPayloadStorageKey(workspaceId, draftKey))
  } catch {
    return null
  }
}

/** Writes an exact serialized draft payload. Used for lossless rollback. */
export function writePayloadRaw(
  workspaceId: string,
  draftKey: string,
  serializedPayload: string
): boolean {
  if (!isStorageAvailable()) return false

  try {
    localStorage.setItem(
      draftPayloadStorageKey(workspaceId, draftKey),
      serializedPayload
    )
    return true
  } catch (error) {
    if (isQuotaExceeded(error)) return false
    throw error
  }
}

/**
 * Reads a draft payload from localStorage.
 */
export function readPayload(
  workspaceId: string,
  draftKey: string
): DraftPayloadV2 | null {
  const json = readPayloadRaw(workspaceId, draftKey)
  if (json === null) return null

  try {
    const parsed = JSON.parse(json)
    return isValidPayload(parsed) ? parsed : null
  } catch {
    return null
  }
}

/**
 * Writes a draft payload to localStorage.
 */
export function writePayload(
  workspaceId: string,
  draftKey: string,
  payload: DraftPayloadV2
): boolean {
  return writePayloadRaw(workspaceId, draftKey, JSON.stringify(payload))
}

/**
 * Deletes a draft payload from localStorage.
 */
export function deletePayload(workspaceId: string, draftKey: string): boolean {
  try {
    localStorage.removeItem(draftPayloadStorageKey(workspaceId, draftKey))
    return true
  } catch {
    return false
  }
}

/**
 * Deletes multiple draft payloads from localStorage.
 */
export function deletePayloads(workspaceId: string, draftKeys: string[]): void {
  for (const draftKey of draftKeys) {
    deletePayload(workspaceId, draftKey)
  }
}

/**
 * Gets all draft payload keys for a workspace from localStorage.
 */
export function getPayloadKeys(workspaceId: string): string[] {
  if (!isStorageReadable()) return []

  const prefix = `${StorageKeys.prefixes.draftPayload}${workspaceId}:`
  const keys: string[] = []

  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i)
      if (key?.startsWith(prefix)) {
        keys.push(key.slice(prefix.length))
      }
    }
  } catch {
    return []
  }

  return keys
}

/**
 * Deletes orphan payloads that are not in the index.
 */
export function deleteOrphanPayloads(
  workspaceId: string,
  indexKeys: Set<string>
): number {
  const payloadKeys = getPayloadKeys(workspaceId)
  let deleted = 0

  for (const key of payloadKeys) {
    if (!indexKeys.has(key)) {
      deletePayload(workspaceId, key)
      deleted++
    }
  }

  return deleted
}

/**
 * Searches sessionStorage for a pointer matching the target workspaceId
 * when the exact clientId key has no entry (e.g. clientId changed after reload).
 * Migrates the found pointer to the new clientId key.
 */
function findAndMigratePointer<T extends { workspaceId: string }>(
  newKey: string,
  prefix: string,
  targetWorkspaceId: string,
  isValid: (value: unknown) => value is T
): T | null {
  for (let i = 0; i < sessionStorage.length; i++) {
    const storageKey = sessionStorage.key(i)
    if (!storageKey?.startsWith(prefix) || storageKey === newKey) continue

    const json = sessionStorage.getItem(storageKey)
    if (!json) continue

    try {
      const pointer: unknown = JSON.parse(json)
      if (isValid(pointer) && pointer.workspaceId === targetWorkspaceId) {
        sessionStorage.setItem(newKey, json)
        sessionStorage.removeItem(storageKey)
        return pointer
      }
    } catch {
      continue
    }
  }
  return null
}

/**
 * Reads a session pointer by clientId with workspace-based fallback.
 * Validates workspace on exact match and removes stale cross-workspace pointers.
 * If no valid entry exists, searches for any pointer matching the target
 * workspaceId and migrates it to the new key.
 */
function readSessionPointer<T extends { workspaceId: string }>(
  key: string,
  prefix: string,
  targetWorkspaceId: string | undefined,
  isValid: (value: unknown) => value is T
): T | null {
  try {
    const json = sessionStorage.getItem(key)
    if (json) {
      const pointer: unknown = JSON.parse(json)
      if (!isValid(pointer)) {
        sessionStorage.removeItem(key)
      } else if (
        targetWorkspaceId &&
        pointer.workspaceId !== targetWorkspaceId
      ) {
        sessionStorage.removeItem(key)
      } else {
        return pointer
      }
    }

    if (targetWorkspaceId) {
      return findAndMigratePointer(key, prefix, targetWorkspaceId, isValid)
    }

    return null
  } catch {
    return null
  }
}

/**
 * Reads the active path pointer from sessionStorage.
 * Falls back to workspace-based search when clientId changes after reload,
 * then to localStorage when sessionStorage is empty (browser restart).
 */
export function readActivePath(
  clientId: string,
  targetWorkspaceId?: string
): ActivePathPointer | null {
  return (
    readSessionPointer<ActivePathPointer>(
      StorageKeys.activePath(clientId),
      StorageKeys.prefixes.activePath,
      targetWorkspaceId,
      isValidActivePathPointer
    ) ??
    (targetWorkspaceId
      ? readLocalPointer<ActivePathPointer>(
          StorageKeys.lastActivePath(targetWorkspaceId),
          isValidActivePathPointer
        )
      : null)
  )
}

/**
 * Writes the active path pointer to both sessionStorage (tab-scoped)
 * and localStorage (survives browser restart).
 */
export function writeActivePath(
  clientId: string,
  pointer: ActivePathPointer
): void {
  const json = JSON.stringify(pointer)
  writeStorage(sessionStorage, StorageKeys.activePath(clientId), json)
  writeStorage(
    localStorage,
    StorageKeys.lastActivePath(pointer.workspaceId),
    json
  )
}

/** Inverse of {@link writeActivePath}: drops both pointers it writes. */
export function clearActivePath(clientId: string, workspaceId: string): void {
  try {
    sessionStorage.removeItem(StorageKeys.activePath(clientId))
    localStorage.removeItem(StorageKeys.lastActivePath(workspaceId))
  } catch {
    // Storage access can throw in private-mode browsers; nothing to undo.
  }
}

/** Reads the durable open-path pointer used for browser-restart recovery. */
export function readPersistentOpenPaths(
  workspaceId: string
): OpenPathsPointer | null {
  const pointer = readLocalPointer<OpenPathsPointer>(
    StorageKeys.lastOpenPaths(workspaceId),
    isValidOpenPathsPointer
  )
  return pointer?.workspaceId === workspaceId ? pointer : null
}

/**
 * Reads the open paths pointer from sessionStorage.
 * Falls back to workspace-based search when clientId changes after reload,
 * then to localStorage when sessionStorage is empty (browser restart).
 */
export function readOpenPaths(
  clientId: string,
  targetWorkspaceId?: string
): OpenPathsPointer | null {
  return (
    readSessionPointer<OpenPathsPointer>(
      StorageKeys.openPaths(clientId),
      StorageKeys.prefixes.openPaths,
      targetWorkspaceId,
      isValidOpenPathsPointer
    ) ?? (targetWorkspaceId ? readPersistentOpenPaths(targetWorkspaceId) : null)
  )
}

/**
 * Writes the open paths pointer to both sessionStorage (tab-scoped)
 * and localStorage (survives browser restart).
 */
export function writeOpenPaths(
  clientId: string,
  pointer: OpenPathsPointer
): void {
  const json = JSON.stringify(pointer)
  writeStorage(sessionStorage, StorageKeys.openPaths(clientId), json)
  writeStorage(
    localStorage,
    StorageKeys.lastOpenPaths(pointer.workspaceId),
    json
  )
}

function hasWorkspaceId(obj: Record<string, unknown>): boolean {
  return typeof obj.workspaceId === 'string'
}

function isValidActivePathPointer(value: unknown): value is ActivePathPointer {
  if (typeof value !== 'object' || value === null) return false
  const obj = value as Record<string, unknown>
  return hasWorkspaceId(obj) && typeof obj.path === 'string'
}

function isValidOpenPathsPointer(value: unknown): value is OpenPathsPointer {
  if (typeof value !== 'object' || value === null) return false
  const obj = value as Record<string, unknown>
  return (
    hasWorkspaceId(obj) &&
    Array.isArray(obj.paths) &&
    typeof obj.activeIndex === 'number'
  )
}

function readLocalPointer<T>(
  key: string,
  validate: (value: unknown) => value is T
): T | null {
  try {
    const json = localStorage.getItem(key)
    if (!json) return null
    const parsed = JSON.parse(json)
    return validate(parsed) ? parsed : null
  } catch {
    return null
  }
}

function writeStorage(storage: Storage, key: string, value: string): void {
  if (!isStorageAvailable()) return

  try {
    storage.setItem(key, value)
  } catch {
    // Best effort — silently degrade when storage is full or unavailable
  }
}

const legacyLocalRestoreKeys = [
  'Comfy.Workflow.Drafts',
  'Comfy.Workflow.DraftOrder',
  'Comfy.OpenWorkflowsPaths',
  'Comfy.ActiveWorkflowIndex',
  'Comfy.PreviousWorkflow',
  'workflow'
]

const sessionRestorePrefixes = [
  StorageKeys.prefixes.activePath,
  StorageKeys.prefixes.openPaths,
  'Comfy.PreviousWorkflow:',
  'Comfy.OpenWorkflowsPaths:',
  'Comfy.ActiveWorkflowIndex:',
  'workflow:'
]

const sessionRestoreKeys = [
  'Comfy.PreviousWorkflow',
  'Comfy.OpenWorkflowsPaths',
  'Comfy.ActiveWorkflowIndex'
]

function removeStorageKeys(
  storage: Storage,
  keys: string[],
  prefixes: string[] = []
): void {
  try {
    for (let i = storage.length - 1; i >= 0; i--) {
      const key = storage.key(i)
      if (
        key &&
        (keys.includes(key) ||
          prefixes.some((prefix) => key.startsWith(prefix)))
      ) {
        try {
          storage.removeItem(key)
        } catch {
          continue
        }
      }
    }
  } catch {
    return
  }
}

export function clearWorkflowRestoreState(): void {
  removeStorageKeys(localStorage, legacyLocalRestoreKeys)
  removeStorageKeys(sessionStorage, sessionRestoreKeys, sessionRestorePrefixes)
}

export function prepareWorkflowWorkspaceTransition(): () => void {
  let ownerId: symbol | undefined
  if (workflowStorageState.status === 'ready') {
    flushPendingWorkflowPersistence()
    ownerId = Symbol('workflow-storage-transition')
    workflowStorageState = {
      status: 'transitioning',
      reason: 'workspace',
      resumeAvailability: workflowStorageState.availability,
      ownerId
    }
  }
  clearWorkflowRestoreState()

  return () => {
    if (
      workflowStorageState.status !== 'transitioning' ||
      workflowStorageState.reason !== 'workspace' ||
      workflowStorageState.ownerId !== ownerId
    )
      return

    workflowStorageState = {
      status: 'ready',
      availability: workflowStorageState.resumeAvailability
    }
  }
}

export function prepareWorkflowLogoutTransition(): void {
  workflowStorageState = {
    status: 'transitioning',
    reason: 'logout',
    resumeAvailability:
      workflowStorageState.status === 'transitioning'
        ? workflowStorageState.resumeAvailability
        : workflowStorageState.availability
  }
}

export function completeWorkflowLogoutTransition(): void {
  if (
    workflowStorageState.status !== 'transitioning' ||
    workflowStorageState.reason !== 'logout'
  )
    return

  workflowStorageState = {
    status: 'ready',
    availability: workflowStorageState.resumeAvailability
  }
}

export function clearAllWorkflowStorage(): void {
  const localPrefixes = [
    StorageKeys.prefixes.draftIndex,
    StorageKeys.prefixes.draftPayload,
    StorageKeys.prefixes.lastActivePath,
    StorageKeys.prefixes.lastOpenPaths,
    'Comfy.Workflow.Drafts:',
    'Comfy.Workflow.DraftOrder:'
  ]

  removeStorageKeys(localStorage, legacyLocalRestoreKeys, localPrefixes)
  removeStorageKeys(sessionStorage, sessionRestoreKeys, sessionRestorePrefixes)
}
