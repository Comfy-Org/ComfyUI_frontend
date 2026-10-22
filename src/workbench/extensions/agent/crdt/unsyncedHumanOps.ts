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

/**
 * Records, per recorder, the workflows whose canvas holds human edits the
 * shared document may lack. Survives reloads of this browser tab.
 */
export function recordUnsyncedHumanOps(
  recorder: string,
  workflowIds: Iterable<string>
): void {
  const ids = new Set(workflowIds)
  if (ids.size === 0) unsyncedByRecorder.delete(recorder)
  else unsyncedByRecorder.set(recorder, ids)
  writeStored([...unsyncedNow()])
}

/**
 * Whether `workflowId` has human edits the shared document may lack, recorded
 * by this page or carried over from a page before a reload.
 */
export function hasUnsyncedHumanOps(workflowId: string): boolean {
  return unsyncedNow().has(workflowId)
}

/**
 * Drops what an earlier page recorded for `workflowId` once this page has
 * subscribed to it, from which point this page's own record is authoritative.
 */
export function forgetUnsyncedAtLoad(workflowId: string): void {
  if (!loadOnce().delete(workflowId)) return
  writeStored([...unsyncedNow()])
}
