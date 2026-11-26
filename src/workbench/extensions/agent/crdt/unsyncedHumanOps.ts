import { safeSessionStorage } from '@/base/storage/safeStorage'

const STORAGE_KEY = 'Comfy.Agent.UnsyncedHumanOps'

let unsyncedAtLoad: Set<string> | null = null
const unsyncedByRecorder = new Map<string, ReadonlySet<string>>()
const pendingByRecorder = new Map<string, ReadonlySet<string>>()

function readStored(): string[] {
  try {
    const parsed: unknown = JSON.parse(
      safeSessionStorage.getItem(STORAGE_KEY) ?? '[]'
    )
    return Array.isArray(parsed)
      ? parsed.filter((id): id is string => typeof id === 'string')
      : []
  } catch {
    return []
  }
}

function writeStored(ids: readonly string[]): void {
  if (ids.length === 0) safeSessionStorage.removeItem(STORAGE_KEY)
  else safeSessionStorage.setItem(STORAGE_KEY, JSON.stringify(ids))
}

function loadOnce(): Set<string> {
  unsyncedAtLoad ??= new Set(readStored())
  return unsyncedAtLoad
}

function unsyncedNow(): Set<string> {
  return new Set([
    ...loadOnce(),
    ...[...unsyncedByRecorder.values()].flatMap((ids) => [...ids]),
    ...[...pendingByRecorder.values()].flatMap((ids) => [...ids])
  ])
}

function setRecorderWorkflows(
  map: Map<string, ReadonlySet<string>>,
  recorder: string,
  workflowIds: Iterable<string>
): void {
  const ids = new Set(workflowIds)
  if (ids.size === 0) map.delete(recorder)
  else map.set(recorder, ids)
}

/** Records this recorder's workflows with non-replayable unsynced edits and optional live pending batches. */
export function recordUnsyncedHumanOps(
  recorder: string,
  workflowIds: Iterable<string>,
  pendingWorkflowIds?: Iterable<string>
): void {
  setRecorderWorkflows(unsyncedByRecorder, recorder, workflowIds)
  if (pendingWorkflowIds !== undefined)
    setRecorderWorkflows(pendingByRecorder, recorder, pendingWorkflowIds)
  writeStored([...unsyncedNow()])
}

/** Preserves a disposed recorder's warnings for its successor. */
export function releaseUnsyncedHumanOpsRecorder(recorder: string): void {
  const recorded = unsyncedByRecorder.get(recorder)
  const pending = pendingByRecorder.get(recorder)
  if (recorded === undefined && pending === undefined) return
  for (const workflowId of recorded ?? []) loadOnce().add(workflowId)
  for (const workflowId of pending ?? []) loadOnce().add(workflowId)
  unsyncedByRecorder.delete(recorder)
  pendingByRecorder.delete(recorder)
  writeStored([...unsyncedNow()])
}

/** Whether `workflowId`'s canvas holds edits the shared document may lack. */
export function hasUnsyncedHumanOps(workflowId: string): boolean {
  return unsyncedNow().has(workflowId)
}

/** Whether `workflowId` holds unsynced intent outside `heldByRecorder`'s live pending batches. */
export function hasBlockingUnsyncedHumanOps(
  workflowId: string,
  heldByRecorder?: string
): boolean {
  if (loadOnce().has(workflowId)) return true
  for (const ids of unsyncedByRecorder.values()) {
    if (ids.has(workflowId)) return true
  }
  for (const [recorder, ids] of pendingByRecorder) {
    if (recorder !== heldByRecorder && ids.has(workflowId)) return true
  }
  return false
}

/** Drops what a page before this one recorded for `workflowId`. */
export function forgetUnsyncedAtLoad(workflowId: string | null): void {
  if (workflowId === null) return
  if (!loadOnce().delete(workflowId)) return
  writeStored([...unsyncedNow()])
}
