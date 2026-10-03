/**
 * Document lifecycle: when an editing session begins, is shown, is hidden, and
 * ends.
 *
 * Packs keep state per document — an index of their own nodes, a cached
 * projection, a panel's scroll position. Without these they had two ways to
 * find out it was stale, and both are wrong. `onWorkflowLoaded` fires for undo
 * and for reloads of the same document as readily as for a swap. And nothing
 * at all announced a close, so state for a tab the user shut stayed keyed under
 * an id that would never come back — the leak the host's own subsystems have
 * been paying for one hand-rolled special case at a time.
 *
 * A phase is an observation, not a hook: a listener cannot veto a transition or
 * change what happens next. Vetoing a close is the host's business — it owns
 * the unsaved-changes conversation with the user — and handing packs a say in
 * it would mean any installed pack could refuse to let a document close.
 */
import type { DocumentHandle, DocumentReader } from './documentHandle'
import { createDocumentHandle } from './documentHandle'
import type { Unsubscribe } from './widgetHandle'

/**
 * The transitions a document makes.
 *
 * `opened` and `closed` bracket the session's existence; `activated` and
 * `deactivated` bracket its time on screen. A document opened in the
 * background is `opened` without being `activated`, which is why they are
 * separate: a pack that allocates on `opened` and releases on `closed` stays
 * balanced no matter how the user moves between tabs.

 */
export type DocumentPhase = 'opened' | 'activated' | 'deactivated' | 'closed'

type Listener = (document: DocumentHandle) => void

const listeners = new Map<DocumentPhase, Set<Listener>>()

function run(listener: Listener, document: DocumentHandle): void {
  try {
    listener(document)
  } catch (error) {
    // One pack mishandling a transition must not strand the packs behind it
    // mid-lifecycle, holding state for a document that is already gone.
    console.error('[nodeApi] document lifecycle listener threw', error)
  }
}

/**
 * Called by the host when a document makes a transition.
 *
 * The session id rather than a handle, so the host does not have to know how
 * handles are made; this mints one bound to the same reader every other handle
 * uses, so a listener's `isDeleted` is answered live. On `closed` that is
 * already `true` by the time the listener runs, which is the point — the
 * handle carries the id to clean up by and refuses to describe a document that
 * is gone.
 */
export function notifyDocumentPhase(
  phase: DocumentPhase,
  sessionId: string,
  read: DocumentReader
): void {
  const subscribers = listeners.get(phase)
  if (!subscribers?.size) return
  const document = createDocumentHandle(sessionId, read)
  for (const listener of [...subscribers]) run(listener, document)
}

export function onDocumentPhase(
  phase: DocumentPhase,
  listener: Listener
): Unsubscribe {
  let subscribers = listeners.get(phase)
  if (!subscribers) {
    subscribers = new Set()
    listeners.set(phase, subscribers)
  }
  subscribers.add(listener)
  return () => {
    listeners.get(phase)?.delete(listener)
  }
}

/** Test seam. */
export function resetDocumentLifecycleForTest(): void {
  listeners.clear()
}
