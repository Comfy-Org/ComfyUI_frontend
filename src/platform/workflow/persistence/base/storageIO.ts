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
import { ref } from 'vue'
import { StorageKeys, resolveStorageScope } from './storageKeys'
import type { StorageScope } from './storageKeys'

type StorageAvailability = 'available' | 'unavailable'
type StorageWriteGate = 'open' | 'deferred' | 'closed'
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
const storageIdentity = ref<string | null>(null)
const storageWorkspaceId = ref<string | null>(null)
const storageScopeRevision = ref(0)
const pendingPersistenceFlushes = new Set<() => void>()

/** @internal Owned by useStorageScopeLifecycle; exported for isolated tests. */
export function setStorageIdentity(userId: string | null): void {
  storageIdentity.value = userId
}

export function getStorageIdentity(): string | null {
  return storageIdentity.value
}

/** @internal Owned by useStorageScopeLifecycle; exported for isolated tests. */
export function setStorageWorkspaceId(workspaceId: string | null): void {
  storageWorkspaceId.value = workspaceId
}

export function getStorageScope(): StorageScope | null {
  void storageScopeRevision.value
  if (workflowStorageState.status === 'transitioning') return null
  return resolveStorageScope(storageIdentity.value, storageWorkspaceId.value)
}

export function getStorageWriteGate(): StorageWriteGate {
  void storageScopeRevision.value
  if (workflowStorageState.status === 'transitioning') return 'deferred'
  if (getStorageScope() === null) return 'deferred'
  return workflowStorageState.availability === 'available' ? 'open' : 'closed'
}

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
  return getStorageWriteGate() === 'open'
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

function isValidIndex(value: unknown): value is DraftIndexV2 {
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

/**
 * Reads and parses the draft index from localStorage.
 */
export function readIndex(scope: StorageScope): DraftIndexV2 | null {
  if (!isStorageReadable()) return null

  try {
    const key = StorageKeys.draftIndex(scope)
    const json = localStorage.getItem(key)
    if (!json) return null

    const parsed = JSON.parse(json)
    if (!isValidIndex(parsed)) return null

    return parsed
  } catch {
    return null
  }
}

/**
 * Writes the draft index to localStorage.
 */
export function writeIndex(scope: StorageScope, index: DraftIndexV2): boolean {
  if (!isStorageAvailable()) return false

  try {
    const key = StorageKeys.draftIndex(scope)
    localStorage.setItem(key, JSON.stringify(index))
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
  scope: StorageScope,
  draftKey: string
): DraftPayloadV2 | null {
  if (!isStorageReadable()) return null

  try {
    const key = `${StorageKeys.prefixes.draftPayload}${scope}:${draftKey}`
    const json = localStorage.getItem(key)
    if (!json) return null

    return JSON.parse(json) as DraftPayloadV2
  } catch {
    return null
  }
}

/**
 * Writes a draft payload to localStorage.
 */
export function writePayload(
  scope: StorageScope,
  draftKey: string,
  payload: DraftPayloadV2
): boolean {
  if (!isStorageAvailable()) return false

  try {
    const key = `${StorageKeys.prefixes.draftPayload}${scope}:${draftKey}`
    localStorage.setItem(key, JSON.stringify(payload))
    return true
  } catch (error) {
    if (isQuotaExceeded(error)) return false
    throw error
  }
}

/**
 * Deletes a draft payload from localStorage.
 */
export function deletePayload(scope: StorageScope, draftKey: string): void {
  try {
    const key = `${StorageKeys.prefixes.draftPayload}${scope}:${draftKey}`
    localStorage.removeItem(key)
  } catch {
    // Ignore errors during deletion
  }
}

/**
 * Deletes multiple draft payloads from localStorage.
 */
export function deletePayloads(scope: StorageScope, draftKeys: string[]): void {
  for (const draftKey of draftKeys) {
    deletePayload(scope, draftKey)
  }
}

/**
 * Gets all draft payload keys for a workspace from localStorage.
 */
export function getPayloadKeys(scope: StorageScope): string[] {
  if (!isStorageReadable()) return []

  const prefix = `${StorageKeys.prefixes.draftPayload}${scope}:`
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
  scope: StorageScope,
  indexKeys: Set<string>
): number {
  const payloadKeys = getPayloadKeys(scope)
  let deleted = 0

  for (const key of payloadKeys) {
    if (!indexKeys.has(key)) {
      deletePayload(scope, key)
      deleted++
    }
  }

  return deleted
}

interface StoredActivePathPointer {
  workspaceId: string
  path: string
}

interface StoredOpenPathsPointer {
  workspaceId: string
  paths: string[]
  activeIndex: number
}

/**
 * Searches sessionStorage for a pointer matching the target workspaceId
 * when the exact clientId key has no entry (e.g. clientId changed after reload).
 * Migrates the found pointer to the new clientId key.
 */

function findAndMigratePointer<T extends { workspaceId: string }>(
  newKey: string,
  prefix: string,
  targetScope: StorageScope,
  isValid: (value: unknown) => value is T
): T | null {
  for (let i = 0; i < sessionStorage.length; i++) {
    const storageKey = sessionStorage.key(i)
    if (!storageKey?.startsWith(prefix) || storageKey === newKey) continue

    const json = sessionStorage.getItem(storageKey)
    if (!json) continue

    try {
      const pointer: unknown = JSON.parse(json)
      if (isValid(pointer) && pointer.workspaceId === targetScope) {
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
  targetScope: StorageScope,
  isValid: (value: unknown) => value is T
): T | null {
  try {
    const json = sessionStorage.getItem(key)
    if (json) {
      const pointer: unknown = JSON.parse(json)
      if (!isValid(pointer)) {
        sessionStorage.removeItem(key)
      } else if (pointer.workspaceId !== targetScope) {
        sessionStorage.removeItem(key)
      } else {
        return pointer
      }
    }

    return findAndMigratePointer(key, prefix, targetScope, isValid)
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
  targetScope: StorageScope
): ActivePathPointer | null {
  const pointer =
    readSessionPointer<StoredActivePathPointer>(
      StorageKeys.activePath(clientId),
      StorageKeys.prefixes.activePath,
      targetScope,
      isValidActivePathPointer
    ) ??
    readLocalPointer<StoredActivePathPointer>(
      StorageKeys.lastActivePath(targetScope),
      isValidActivePathPointer
    )
  return pointer?.workspaceId === targetScope
    ? { ...pointer, workspaceId: targetScope }
    : null
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
export function clearActivePath(clientId: string, scope: StorageScope): void {
  try {
    sessionStorage.removeItem(StorageKeys.activePath(clientId))
    localStorage.removeItem(StorageKeys.lastActivePath(scope))
  } catch {
    // Storage access can throw in private-mode browsers; nothing to undo.
  }
}

/**
 * Reads the open paths pointer from sessionStorage.
 * Falls back to workspace-based search when clientId changes after reload,
 * then to localStorage when sessionStorage is empty (browser restart).
 */
export function readOpenPaths(
  clientId: string,
  targetScope: StorageScope
): OpenPathsPointer | null {
  const pointer =
    readSessionPointer<StoredOpenPathsPointer>(
      StorageKeys.openPaths(clientId),
      StorageKeys.prefixes.openPaths,
      targetScope,
      isValidOpenPathsPointer
    ) ??
    readLocalPointer<StoredOpenPathsPointer>(
      StorageKeys.lastOpenPaths(targetScope),
      isValidOpenPathsPointer
    )
  return pointer?.workspaceId === targetScope
    ? { ...pointer, workspaceId: targetScope }
    : null
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

function isValidActivePathPointer(
  value: unknown
): value is StoredActivePathPointer {
  if (typeof value !== 'object' || value === null) return false
  const obj = value as Record<string, unknown>
  return hasWorkspaceId(obj) && typeof obj.path === 'string'
}

function isValidOpenPathsPointer(
  value: unknown
): value is StoredOpenPathsPointer {
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

const legacyLocalRestorePointerKeys = [
  'Comfy.OpenWorkflowsPaths',
  'Comfy.ActiveWorkflowIndex',
  'Comfy.PreviousWorkflow',
  'workflow'
]

const legacyAgentKeys = [
  'Comfy.Agent.ThreadId',
  'Comfy.Agent.WorkflowTabBindings',
  'Comfy.Agent.WorkflowTabBindings.v2',
  'Comfy.Agent.ChatTitles',
  'Comfy.Agent.DeletedThreads'
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

export function clearLegacyAgentStorage(): void {
  removeStorageKeys(localStorage, legacyAgentKeys)
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
    storageScopeRevision.value++
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
    storageScopeRevision.value++
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
  storageScopeRevision.value++
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
  storageScopeRevision.value++
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

/**
 * Removes persisted state owned by one resolved auth/workspace scope, plus
 * unscoped local and per-tab restore pointers that could reopen that session.
 * Ownerless legacy draft and order blobs are deliberately preserved.
 */
export function clearWorkflowStorageForScope(scope: StorageScope): void {
  const localKeys = [
    StorageKeys.draftIndex(scope),
    StorageKeys.lastActivePath(scope),
    StorageKeys.lastOpenPaths(scope),
    StorageKeys.agentThread(scope),
    StorageKeys.agentWorkflowTabBindings(scope),
    StorageKeys.agentChatTitles(scope),
    StorageKeys.agentDeletedThreads(scope),
    ...legacyLocalRestorePointerKeys
  ]
  const localPrefixes = [`${StorageKeys.prefixes.draftPayload}${scope}:`]

  removeStorageKeys(localStorage, localKeys, localPrefixes)
  removeStorageKeys(sessionStorage, sessionRestoreKeys, sessionRestorePrefixes)
}
