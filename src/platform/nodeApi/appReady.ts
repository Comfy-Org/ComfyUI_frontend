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
 * The active document's identity: a process-local id for one editing session.
 *
 * Not `graph.id` — that one is restored FROM the saved workflow in
 * `_configureBase` and round-trips through `serialize()`, so it is the same
 * value across two independent opens of the same file, and the same value
 * again for a copy made outside the app. This answers a different question:
 * not "which file is this" but "am I still looking at the session I was". A
 * pack, or a cached projection of graph state, compares the id it last
 * captured against this one to tell a document swap from ordinary editing —
 * which watching graph mutations cannot do, because mutations are what
 * editing this exact document IS.
 *
 * Supplied by the host rather than minted here, because the boundary is the
 * editing session and only the host knows where that begins. It was minted at
 * `loadGraphData`'s tail, which sounds like "a workflow finished loading" and
 * is not: undo and redo reach that line too, through
 * `ChangeTracker.updateState`, so every undo step announced a new document and
 * invalidated every cached projection in the app. The id now tracks the
 * session that owns the change tracker, so undo, redo and a same-document
 * reload all keep it, and a tab the user returns to keeps the id it had.
 */
let documentId: string | undefined

/**
 * Called by the host each time a workflow finishes being configured, with the
 * identity of the session it belongs to.
 *
 * Passing nothing means the host could not name a session — loading raw
 * workflow data with no backing file, for instance — which is a new document,
 * so one is minted.
 */
export function notifyWorkflowLoaded(sessionId?: string | null): void {
  documentId = sessionId ?? createUuidv4()
  for (const listener of [...workflowLoaded]) run(listener)
}

/**
 * Fires whenever a workflow finishes being configured, including for undo,
 * redo and a reload of the same document — it is the host's
 * `afterConfigureGraph`, and packs rebuilding state from the graph need all of
 * those. Read {@link currentDocumentId} inside the listener to tell which of
 * them just happened: an unchanged id means the same document was rebuilt.
 */
export function onWorkflowLoaded(listener: () => void): Unsubscribe {
  workflowLoaded.add(listener)
  return () => workflowLoaded.delete(listener)
}

/** Undefined before the first workflow has loaded this page load. */
export function currentDocumentId(): string | undefined {
  return documentId
}

/** Test seam. The host marks readiness exactly once per page load. */
export function resetAppReadyForTest(): void {
  ready = false
  waiting.clear()
  workflowLoaded.clear()
  documentId = undefined
}
