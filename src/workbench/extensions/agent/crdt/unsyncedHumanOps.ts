const STORAGE_KEY = 'Comfy.Agent.UnsyncedHumanOps'

let unsyncedAtLoad: Set<string> | null = null
const unsyncedByRecorder = new Map<string, ReadonlySet<string>>()
const pendingByRecorder = new Map<string, ReadonlySet<string>>()

function readStored(): string[] {
  try {
    const parsed: unknown = JSON.parse(
      sessionStorage.getItem(STORAGE_KEY) ?? '[]'
    )
    return Array.isArray(parsed)
      ? parsed.filter((id): id is string => typeof id === 'string')
      : []
  } catch {
    return []
  }
}

function writeStored(ids: readonly string[]): void {
  try {
    if (ids.length === 0) sessionStorage.removeItem(STORAGE_KEY)
    else sessionStorage.setItem(STORAGE_KEY, JSON.stringify(ids))
  } catch {
    return
  }
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

/** Records this recorder's workflows whose canvas holds non-replayable unsynced edits. */
export function recordUnsyncedHumanOps(
  recorder: string,
  workflowIds: Iterable<string>
): void {
  const ids = new Set(workflowIds)
  if (ids.size === 0) unsyncedByRecorder.delete(recorder)
  else unsyncedByRecorder.set(recorder, ids)
  writeStored([...unsyncedNow()])
}

/** Records this recorder's workflows with unsettled batches still queued in memory. */
export function recordPendingHumanOps(
  recorder: string,
  workflowIds: Iterable<string>
): void {
  const ids = new Set(workflowIds)
  if (ids.size === 0) pendingByRecorder.delete(recorder)
  else pendingByRecorder.set(recorder, ids)
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
