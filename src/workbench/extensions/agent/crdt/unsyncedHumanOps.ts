const STORAGE_KEY = 'Comfy.Agent.UnsyncedHumanOps'

let unsyncedAtLoad: Set<string> | null = null
const unsyncedByRecorder = new Map<string, ReadonlySet<string>>()

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
    ...[...unsyncedByRecorder.values()].flatMap((ids) => [...ids])
  ])
}

/** Records this recorder's workflows whose canvas holds edits the doc may lack. */
export function recordUnsyncedHumanOps(
  recorder: string,
  workflowIds: Iterable<string>
): void {
  const ids = new Set(workflowIds)
  if (ids.size === 0) unsyncedByRecorder.delete(recorder)
  else unsyncedByRecorder.set(recorder, ids)
  writeStored([...unsyncedNow()])
}

/** Whether `workflowId`'s canvas holds edits the shared document may lack. */
export function hasUnsyncedHumanOps(workflowId: string): boolean {
  return unsyncedNow().has(workflowId)
}

/** Drops what a page before this one recorded for `workflowId`. */
export function forgetUnsyncedAtLoad(workflowId: string | null): void {
  if (workflowId === null) return
  if (!loadOnce().delete(workflowId)) return
  writeStored([...unsyncedNow()])
}
