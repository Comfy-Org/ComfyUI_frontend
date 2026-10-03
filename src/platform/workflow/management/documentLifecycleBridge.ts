/**
 * Turns the workflow store's state into the node API's document lifecycle.
 *
 * Derived by diffing rather than reported by each call site, because the call
 * sites are exactly what cannot be trusted to report. A tab can leave existence
 * through `closeWorkflow`, through deletion of a temporary workflow that never
 * calls `unload()`, and through `syncWorkflows` quietly unloading a background
 * tab whose file changed on disk — that last one destroys a session's undo
 * history and state with no event fired anywhere. Watching the set of live
 * sessions catches all three, including any fourth nobody has written yet.
 *
 * A session id exists only between `load()` and `unload()`, so appearing and
 * disappearing from this set is exactly the document's life.
 */
import { watch } from 'vue'

import { notifyDocumentPhase } from '@/platform/nodeApi/documentLifecycle'
import type { DocumentSource } from '@/platform/nodeApi/documentHandle'

import { useWorkflowStore } from './stores/workflowStore'

/**
 * Every open document that has begun its editing session.
 *
 * A tab opened in the background has no session until it is loaded, so it is
 * absent here until then — which is correct: there is no editing session to
 * announce, and announcing one would hand out a handle describing a document
 * that does not yet exist.
 */
export function openDocuments(): readonly DocumentSource[] {
  const store = useWorkflowStore()
  const activePath = store.activeWorkflow?.path
  return store.openWorkflows
    .filter((workflow) => workflow.sessionId)
    .map((workflow) => ({
      sessionId: workflow.sessionId,
      filename: workflow.filename,
      path: workflow.path,
      isModified: workflow.isModified,
      isActive: workflow.path === activePath
    }))
}

/**
 * Starts announcing document transitions. Returns a function that stops.
 */
export function installDocumentLifecycleBridge(): () => void {
  let known = new Set<string>()
  let active: string | undefined

  const sync = () => {
    const documents = openDocuments()
    const live = new Set(
      documents.flatMap(({ sessionId }) => (sessionId ? [sessionId] : []))
    )

    for (const sessionId of live) {
      if (!known.has(sessionId)) {
        notifyDocumentPhase('opened', sessionId, openDocuments)
      }
    }

    const nextActive = documents.find(({ isActive }) => isActive)?.sessionId
    if (active !== nextActive) {
      // Deactivate before activate, so a listener moving state between them
      // never sees two documents claiming to be on screen. A document that
      // closed while active is announced as closed below rather than
      // deactivated first — it did not step aside, it ceased to exist.
      if (active && live.has(active)) {
        notifyDocumentPhase('deactivated', active, openDocuments)
      }
      if (nextActive) {
        notifyDocumentPhase('activated', nextActive, openDocuments)
      }
      active = nextActive ?? undefined
    }

    // Last, and against the already-updated set, so `isDeleted` is true inside
    // the listener. A pack must not be able to act on a document that is gone
    // merely because it was told promptly.
    for (const sessionId of known) {
      if (!live.has(sessionId)) {
        notifyDocumentPhase('closed', sessionId, openDocuments)
      }
    }

    known = live
  }

  const store = useWorkflowStore()
  return watch(
    () => [
      store.openWorkflows.map((workflow) => workflow.sessionId).join(','),
      store.activeWorkflow?.sessionId
    ],
    sync,
    { immediate: true }
  )
}
