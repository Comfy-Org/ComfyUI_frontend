/**
 * "The application has finished starting."
 *
 * A pack's module body runs before node definitions are registered, which
 * matches what `registerExtension({ init })` promised. Nothing matched
 * `setup()` — the later point where the canvas, the settings and the graph all
 * exist — so converted packs either ran setup work too early or hand-rolled a
 * poll for the DOM to appear. Both are the same bug at different volumes.
 */
import { reportError } from '@/platform/telemetry/reportError'
import { createUuidv4 } from '@/utils/uuid'
import type { UUID } from '@/utils/uuid'

import type { Unsubscribe } from './widgetHandle'

let ready = false
const waiting = new Set<() => void>()

/** Called by the host once, at the point legacy `setup()` extensions ran. */
export function markAppReady(): void {
  if (ready) return
  ready = true
  for (const listener of waiting) run(listener)
  waiting.clear()
}

function run(listener: () => void): void {
  try {
    listener()
  } catch (error) {
    // One pack's failed startup must not abort the packs queued behind it.
    console.error('[nodeApi] lifecycle listener threw', error)
    reportError(error, { errorType: 'node_api_lifecycle_listener_failure' })
  }
}

export function onAppReady(listener: () => void): Unsubscribe {
  if (ready) {
    // Never synchronous: a caller that has not finished its own module body
    // would otherwise be re-entered partway through it.
    let active = true
    queueMicrotask(() => {
      if (active) run(listener)
    })
    return () => {
      active = false
    }
  }
  waiting.add(listener)
  return () => waiting.delete(listener)
}

const workflowLoaded = new Set<() => void>()

/**
 * The active document's identity: a process-local id, live only for as long
 * as this document is the one on screen.
 *
 * Not `graph.id` — that one is restored FROM the saved workflow in
 * `_configureBase` and round-trips through `serialize()`, so it is the same
 * value across two independent opens of the same file. This is the opposite:
 * a fresh id every time, including for two loads of that same file, because
 * it answers a different question — not "which file is this" but "have I
 * already seen this load". A pack (or a cached projection of graph state)
 * compares the id it last captured against this one to tell a document swap
 * from ordinary editing, which no amount of watching graph mutations can do
 * on its own — mutations are what editing this exact document IS.
 *
 * Minted here from the common successful-load hook for workflow, API JSON and
 * A1111 imports. Undo/redo restores this same document's prior state without
 * reloading it, and must not look like a new one.
 */
let documentId: UUID | undefined

/** Called by the host each time a workflow finishes being configured. */
export function notifyWorkflowLoaded(): void {
  documentId = createUuidv4()
  for (const listener of [...workflowLoaded]) run(listener)
}

export function onWorkflowLoaded(listener: () => void): Unsubscribe {
  workflowLoaded.add(listener)
  return () => workflowLoaded.delete(listener)
}

/** Undefined before the first workflow has loaded this page load. */
export function currentDocumentId(): UUID | undefined {
  return documentId
}

/** Test seam. The host marks readiness exactly once per page load. */
export function resetAppReadyForTest(): void {
  ready = false
  waiting.clear()
  workflowLoaded.clear()
  documentId = undefined
}
