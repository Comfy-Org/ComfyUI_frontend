import { reportError } from '@comfyorg/telemetry/reportError'

/**
 * V2 Storage I/O - localStorage read/write with error handling.
 *
 * Handles quota management, orphan cleanup, and graceful degradation.
 */

import type {
  SafeStorage,
  StorageWriteOutcome
} from '@/base/storage/safeStorage'
import {
  safeLocalStorage,
  safeSessionStorage
} from '@/base/storage/safeStorage'

import type {
  ActivePathPointer,
  DraftIndexV2,
  DraftPayloadV2,
  OpenPathsPointer
} from './draftTypes'
import { KEPT_BUILD_KEY } from '@/platform/workspace/platformFrame/platformFrameBuild'

import { StorageKeys } from './storageKeys'

type StorageAvailability = 'available' | 'unavailable'
type WorkflowStorageFencePolicy = 'identity' | 'workspace'
export interface WorkflowStorageFence {
  release(): void
  releaseAndResumePersistence(): boolean
}
const workflowStorageAuthFenceToken = Symbol('workflow-storage-auth-fence')
export interface WorkflowStorageAuthFence {
  readonly [workflowStorageAuthFenceToken]: true
}
type WorkflowStorageState =
  | { status: 'ready'; availability: StorageAvailability }
  | {
      status: 'transitioning'
      resumeAvailability: StorageAvailability
      transitions: ReadonlyMap<symbol, WorkflowStorageFencePolicy>
    }

let workflowStorageState: WorkflowStorageState = {
  status: 'ready',
  availability: 'available'
}
interface PendingWorkflowPersistence {
  flush: () => void
  cancel: () => void
  resumeAfterAbort: () => void
}

let authStateFence:
  | {
      fence: WorkflowStorageFence
      owner: WorkflowStorageAuthFence
    }
  | undefined

const pendingWorkflowPersistence = new Set<PendingWorkflowPersistence>()

export function registerWorkflowPersistence(
  pending: PendingWorkflowPersistence
): () => void {
  pendingWorkflowPersistence.add(pending)
  return () => pendingWorkflowPersistence.delete(pending)
}

const workflowPersistenceErrorTypes = {
  flush: 'failure_flushing_workflow_persistence',
  cancel: 'failure_cancelling_workflow_persistence',
  resumeAfterAbort: 'failure_resuming_workflow_persistence'
} satisfies Record<keyof PendingWorkflowPersistence, string>

function runPendingWorkflowPersistence(
  operation: keyof PendingWorkflowPersistence
): void {
  for (const pending of pendingWorkflowPersistence) {
    try {
      pending[operation]()
    } catch (error) {
      reportError(error, {
        surface: 'workspace',
        errorType: workflowPersistenceErrorTypes[operation],
        level: 'error'
      })
    }
  }
}

export function isStorageAvailable(): boolean {
  return (
    safeLocalStorage.isPersistent &&
    workflowStorageState.status === 'ready' &&
    workflowStorageState.availability === 'available'
  )
}

export function isWorkflowStorageTransitioning(): boolean {
  return workflowStorageState.status === 'transitioning'
}

export function markStorageUnavailable(): void {
  workflowStorageState =
    workflowStorageState.status === 'transitioning'
      ? { ...workflowStorageState, resumeAvailability: 'unavailable' }
      : { status: 'ready', availability: 'unavailable' }
}

function isStorageReadable(): boolean {
  if (workflowStorageState.status === 'ready') {
    return workflowStorageState.availability === 'available'
  }
  return (
    [...workflowStorageState.transitions.values()].every(
      (policy) => policy === 'workspace'
    ) && workflowStorageState.resumeAvailability === 'available'
  )
}

/** @internal Test-only: do not call from production code paths. */
export function resetStorageAvailable(): void {
  workflowStorageState = { status: 'ready', availability: 'available' }
  authStateFence = undefined
}

function isDraftWritten(outcome: StorageWriteOutcome): boolean {
  if (outcome.result === 'failed') throw outcome.error
  return outcome.result === 'ok'
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
export function readIndex(workspaceId: string): DraftIndexV2 | null {
  if (!isStorageReadable()) return null

  try {
    const key = StorageKeys.draftIndex(workspaceId)
    const json = safeLocalStorage.getItem(key)
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
export function writeIndex(workspaceId: string, index: DraftIndexV2): boolean {
  if (!isStorageAvailable()) return false

  const key = StorageKeys.draftIndex(workspaceId)
  return isDraftWritten(safeLocalStorage.write(key, JSON.stringify(index)))
}

/**
 * Reads a draft payload from localStorage.
 */
export function readPayload(
  workspaceId: string,
  draftKey: string
): DraftPayloadV2 | null {
  if (!isStorageReadable()) return null

  try {
    const key = `${StorageKeys.prefixes.draftPayload}${workspaceId}:${draftKey}`
    const json = safeLocalStorage.getItem(key)
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
  workspaceId: string,
  draftKey: string,
  payload: DraftPayloadV2
): boolean {
  if (!isStorageAvailable()) return false

  const key = `${StorageKeys.prefixes.draftPayload}${workspaceId}:${draftKey}`
  return isDraftWritten(safeLocalStorage.write(key, JSON.stringify(payload)))
}

/**
 * Deletes a draft payload from localStorage.
 */
export function deletePayload(workspaceId: string, draftKey: string): void {
  const key = `${StorageKeys.prefixes.draftPayload}${workspaceId}:${draftKey}`
  safeLocalStorage.removeItem(key)
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
  return safeLocalStorage
    .keys()
    .filter((key) => key.startsWith(prefix))
    .map((key) => key.slice(prefix.length))
}

export interface LocalStorageUsage {
  storageTotalBytes: number
  storageDraftBytes: number
  storageKeyCount: number
  largestOtherStorageKey: string | null
  largestOtherStorageKeyBytes: number
}

/** Returns aggregate usage with draft bytes, or null when storage is unreadable. */
export function measureLocalStorage(): LocalStorageUsage | null {
  const draftPrefixes = [
    StorageKeys.prefixes.draftIndex,
    StorageKeys.prefixes.draftPayload
  ]
  const usage: LocalStorageUsage = {
    storageTotalBytes: 0,
    storageDraftBytes: 0,
    storageKeyCount: 0,
    largestOtherStorageKey: null,
    largestOtherStorageKeyBytes: 0
  }

  try {
    const store = safeLocalStorage.asStorage()
    for (let i = 0; i < store.length; i++) {
      const key = store.key(i)
      if (key === null) return null
      const bytes = (key.length + (store.getItem(key)?.length ?? 0)) * 2
      usage.storageTotalBytes += bytes
      usage.storageKeyCount++
      if (draftPrefixes.some((prefix) => key.startsWith(prefix))) {
        usage.storageDraftBytes += bytes
      } else if (bytes > usage.largestOtherStorageKeyBytes) {
        usage.largestOtherStorageKeyBytes = bytes
        usage.largestOtherStorageKey = key.split(':')[0].slice(0, 64)
      }
    }
  } catch {
    return null
  }

  return usage
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

function findAndMigratePointer<T extends { workspaceId: string }>(
  newKey: string,
  prefix: string,
  targetWorkspaceId: string,
  isValid: (value: unknown) => value is T,
  previousKey: string | null
): T | null {
  const candidateKeys = previousKey ? [previousKey] : []
  for (const storageKey of safeSessionStorage.keys()) {
    if (storageKey.startsWith(prefix) && storageKey !== previousKey) {
      candidateKeys.push(storageKey)
    }
  }

  for (const storageKey of candidateKeys) {
    if (storageKey === newKey) continue
    const pointer = readSessionValue(storageKey, isValid)
    if (pointer?.workspaceId !== targetWorkspaceId) continue
    if (safeSessionStorage.setItem(newKey, JSON.stringify(pointer)) !== 'ok')
      return null
    safeSessionStorage.removeItem(storageKey)
    return pointer
  }
  return null
}

function readSessionPointer<T extends { workspaceId: string }>(
  key: string,
  prefix: string,
  targetWorkspaceId: string | undefined,
  isValid: (value: unknown) => value is T,
  previousKey: string | null
): T | null {
  try {
    const json = safeSessionStorage.getItem(key)
    if (json) {
      const pointer: unknown = JSON.parse(json)
      if (!isValid(pointer)) {
        safeSessionStorage.removeItem(key)
      } else if (
        targetWorkspaceId &&
        pointer.workspaceId !== targetWorkspaceId
      ) {
        safeSessionStorage.removeItem(key)
      } else {
        return pointer
      }
    }

    if (targetWorkspaceId) {
      return findAndMigratePointer(
        key,
        prefix,
        targetWorkspaceId,
        isValid,
        previousKey
      )
    }

    return null
  } catch {
    return null
  }
}

function writeSessionPointer<T extends { workspaceId: string }>(
  key: string,
  prefix: string,
  pointer: T,
  isValid: (value: unknown) => value is T
): void {
  if (!isStorageAvailable()) return

  const saved =
    safeSessionStorage.setItem(key, JSON.stringify(pointer)) === 'ok'
  removeSessionPointers(
    prefix,
    pointer.workspaceId,
    isValid,
    saved ? key : null
  )
}

function removeSessionPointers(
  prefix: string,
  workspaceId: string,
  isValid: (value: unknown) => value is { workspaceId: string },
  keepKey: string | null
): void {
  const staleKeys: string[] = []
  for (const storageKey of safeSessionStorage.keys()) {
    if (!storageKey.startsWith(prefix) || storageKey === keepKey) continue
    if (readSessionValue(storageKey, isValid)?.workspaceId === workspaceId) {
      staleKeys.push(storageKey)
    }
  }
  for (const storageKey of staleKeys) safeSessionStorage.removeItem(storageKey)
}

function readSessionValue<T>(
  key: string,
  isValid: (value: unknown) => value is T
): T | null {
  const json = safeSessionStorage.getItem(key)
  if (!json) return null
  try {
    const value: unknown = JSON.parse(json)
    return isValid(value) ? value : null
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
  clientId: string | null,
  targetWorkspaceId?: string,
  previousClientId: string | null = null
): ActivePathPointer | null {
  return (
    (clientId
      ? readSessionPointer<ActivePathPointer>(
          StorageKeys.activePath(clientId),
          StorageKeys.prefixes.activePath,
          targetWorkspaceId,
          isValidActivePathPointer,
          previousClientId ? StorageKeys.activePath(previousClientId) : null
        )
      : null) ??
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
  writeSessionPointer(
    StorageKeys.activePath(clientId),
    StorageKeys.prefixes.activePath,
    pointer,
    isValidActivePathPointer
  )
  writeStorage(
    safeLocalStorage,
    StorageKeys.lastActivePath(pointer.workspaceId),
    json
  )
}

/** Inverse of {@link writeActivePath}: drops both pointers it writes. */
export function clearActivePath(clientId: string, workspaceId: string): void {
  safeSessionStorage.removeItem(StorageKeys.activePath(clientId))
  safeLocalStorage.removeItem(StorageKeys.lastActivePath(workspaceId))
  removeSessionPointers(
    StorageKeys.prefixes.activePath,
    workspaceId,
    isValidActivePathPointer,
    null
  )
}

/**
 * Reads the open paths pointer from sessionStorage.
 * Falls back to workspace-based search when clientId changes after reload,
 * then to localStorage when sessionStorage is empty (browser restart).
 */
export function readOpenPaths(
  clientId: string | null,
  targetWorkspaceId?: string,
  previousClientId: string | null = null
): OpenPathsPointer | null {
  return (
    (clientId
      ? readSessionPointer<OpenPathsPointer>(
          StorageKeys.openPaths(clientId),
          StorageKeys.prefixes.openPaths,
          targetWorkspaceId,
          isValidOpenPathsPointer,
          previousClientId ? StorageKeys.openPaths(previousClientId) : null
        )
      : null) ??
    (targetWorkspaceId
      ? readLocalPointer<OpenPathsPointer>(
          StorageKeys.lastOpenPaths(targetWorkspaceId),
          isValidOpenPathsPointer
        )
      : null)
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
  writeSessionPointer(
    StorageKeys.openPaths(clientId),
    StorageKeys.prefixes.openPaths,
    pointer,
    isValidOpenPathsPointer
  )
  writeStorage(
    safeLocalStorage,
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
    const json = safeLocalStorage.getItem(key)
    if (!json) return null
    const parsed = JSON.parse(json)
    return validate(parsed) ? parsed : null
  } catch {
    return null
  }
}

function writeStorage(storage: SafeStorage, key: string, value: string): void {
  if (!isStorageAvailable()) return

  storage.setItem(key, value)
}

const legacyLocalRestoreKeys = [
  'Comfy.Workflow.Drafts',
  'Comfy.Workflow.DraftOrder',
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
  storage: SafeStorage,
  keys: string[],
  prefixes: string[] = []
): void {
  for (const key of storage.keys()) {
    if (
      keys.includes(key) ||
      prefixes.some((prefix) => key.startsWith(prefix))
    ) {
      storage.removeItem(key)
    }
  }
}

export function clearLegacyAgentStorage(): void {
  removeStorageKeys(safeLocalStorage, legacyAgentKeys)
}

export function clearWorkflowRestoreState(): void {
  removeStorageKeys(safeLocalStorage, legacyLocalRestoreKeys)
  removeStorageKeys(
    safeSessionStorage,
    sessionRestoreKeys,
    sessionRestorePrefixes
  )
}

export function prepareWorkflowWorkspaceTransition(): WorkflowStorageFence {
  runPendingWorkflowPersistence('flush')
  const fence = acquireWorkflowStorageFence('workspace')
  clearWorkflowRestoreState()

  return fence
}

export function prepareWorkflowLogoutTransition(): WorkflowStorageFence {
  const fence = acquireWorkflowStorageFence('identity')
  runPendingWorkflowPersistence('cancel')
  return fence
}

export function fenceWorkflowStorageForAuthState(): WorkflowStorageAuthFence {
  if (authStateFence) return authStateFence.owner
  authStateFence = {
    fence: acquireWorkflowStorageFence('identity'),
    owner: { [workflowStorageAuthFenceToken]: true }
  }
  runPendingWorkflowPersistence('cancel')
  return authStateFence.owner
}

export function releaseWorkflowStorageAuthFence(
  owner?: WorkflowStorageAuthFence
): void {
  if (!authStateFence) return
  if (owner && owner !== authStateFence.owner) return
  const fence = authStateFence
  authStateFence = undefined
  fence.fence.release()
}

export function abortWorkflowStorageAuthFence(
  owner: WorkflowStorageAuthFence
): boolean {
  if (!authStateFence || owner !== authStateFence.owner) return false
  const fence = authStateFence
  authStateFence = undefined
  return fence.fence.releaseAndResumePersistence()
}

function acquireWorkflowStorageFence(
  policy: WorkflowStorageFencePolicy
): WorkflowStorageFence {
  const transition = Symbol(policy)
  const resumeAvailability =
    workflowStorageState.status === 'ready'
      ? workflowStorageState.availability
      : workflowStorageState.resumeAvailability
  const transitions =
    workflowStorageState.status === 'ready'
      ? new Map<symbol, WorkflowStorageFencePolicy>()
      : new Map(workflowStorageState.transitions)
  transitions.set(transition, policy)
  workflowStorageState = {
    status: 'transitioning',
    resumeAvailability,
    transitions
  }
  const settle = (resumeAfterAbort: boolean): boolean => {
    const resumed = removeWorkflowStorageTransition(transition)
    if (resumed && resumeAfterAbort) {
      runPendingWorkflowPersistence('resumeAfterAbort')
    }
    return resumed
  }
  return {
    release: () => {
      settle(false)
    },
    releaseAndResumePersistence: () => settle(true)
  }
}

function removeWorkflowStorageTransition(transition: symbol): boolean {
  if (
    workflowStorageState.status !== 'transitioning' ||
    !workflowStorageState.transitions.has(transition)
  )
    return false

  const transitions = new Map(workflowStorageState.transitions)
  transitions.delete(transition)
  if (transitions.size > 0) {
    workflowStorageState = { ...workflowStorageState, transitions }
    return false
  }

  workflowStorageState = {
    status: 'ready',
    availability: workflowStorageState.resumeAvailability
  }
  return true
}

export function isIdentityTransition(): boolean {
  return (
    workflowStorageState.status === 'transitioning' &&
    [...workflowStorageState.transitions.values()].includes('identity')
  )
}

/** Removes V1 and pre-account-scope draft keys, which cloud never reads. */
export function clearUnscopedDraftStorage(): void {
  const { draftIndex, draftPayload } = StorageKeys.prefixes
  const scopedSegments = [
    [draftIndex, 2],
    [draftPayload, 3]
  ] as const
  for (const key of safeLocalStorage.keys()) {
    const unscoped =
      key === 'Comfy.Workflow.Drafts' ||
      key === 'Comfy.Workflow.DraftOrder' ||
      key.startsWith('Comfy.Workflow.Drafts:') ||
      key.startsWith('Comfy.Workflow.DraftOrder:') ||
      scopedSegments.some(
        ([prefix, segments]) =>
          key.startsWith(prefix) &&
          key.slice(prefix.length).split(':').length < segments
      )
    if (unscoped) safeLocalStorage.removeItem(key)
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

  removeStorageKeys(safeLocalStorage, legacyLocalRestoreKeys, localPrefixes)
  removeStorageKeys(
    safeSessionStorage,
    sessionRestoreKeys,
    sessionRestorePrefixes
  )
}

export function clearAllWorkspaceStorage(): void {
  clearAllWorkflowStorage()
  clearLegacyAgentStorage()
  removeStorageKeys(safeSessionStorage, [KEPT_BUILD_KEY])
  removeStorageKeys(
    safeLocalStorage,
    [],
    [
      StorageKeys.prefixes.agentThread,
      StorageKeys.prefixes.agentWorkflowTabBindings,
      StorageKeys.prefixes.agentChatTitles,
      StorageKeys.prefixes.agentDeletedThreads,
      StorageKeys.prefixes.agentComposerDraft,
      StorageKeys.prefixes.agentPendingSendDraft,
      StorageKeys.prefixes.agentSkillDrafts
    ]
  )
}
