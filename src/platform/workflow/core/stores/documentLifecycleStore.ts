import { defineStore } from 'pinia'
import { shallowRef } from 'vue'

import type { RootGraphId } from '@/types/graphScopeId'

export type DocumentUid = string & { readonly __brand: 'DocumentUid' }

export function toDocumentUid(value: string): DocumentUid {
  return value as DocumentUid
}

/**
 * Names one graph load. A load hands its token to `activate`/`invalidate` so a
 * load that finishes after a newer one started cannot publish or retract on
 * the newer load's behalf: `loadGraphData` callers such as `ChangeTracker.undo`
 * bypass the workflow-load queue and interleave freely.
 */
export type DocumentTransition = number & {
  readonly __brand: 'DocumentTransition'
}

interface ActiveDocumentBinding {
  readonly uid: DocumentUid
  readonly rootGraphId: RootGraphId
}

/**
 * Owns the one fact that the shared canvas cannot answer for itself: which
 * workflow document its root graph currently represents.
 *
 * The binding tracks the *live* root graph id, not the id the document was
 * loaded with. A root graph can rotate in place without any document
 * transition — `LGraph.clear()` mints a fresh uuid — so a load publishes
 * through `activate` and an in-place rotation reports through
 * `rebindActiveRootGraph`.
 */
export const useDocumentLifecycleStore = defineStore(
  'documentLifecycle',
  () => {
    const activeBinding = shallowRef<ActiveDocumentBinding | null>(null)
    let latestTransition = 0 as DocumentTransition

    function isLatest(transition: DocumentTransition | undefined): boolean {
      return transition === undefined || transition === latestTransition
    }

    /**
     * Open a graph load, retracting the current binding unless the load is
     * staying on the same document. Undo, redo, and same-document reloads keep
     * their binding; everything else — including an import, which has no
     * requested document — fails closed until the load publishes.
     */
    function beginTransition(nextUid: DocumentUid | null): DocumentTransition {
      latestTransition = (latestTransition + 1) as DocumentTransition
      const current = activeBinding.value
      if (current !== null && current.uid !== nextUid)
        activeBinding.value = null
      return latestTransition
    }

    function activate(
      binding: ActiveDocumentBinding,
      transition?: DocumentTransition
    ): void {
      if (!isLatest(transition)) return
      activeBinding.value = binding
    }

    /** Retract the binding for a load that cleared the graph and then failed. */
    function invalidate(transition?: DocumentTransition): void {
      if (!isLatest(transition)) return
      activeBinding.value = null
    }

    /**
     * Follow an in-place root graph id rotation on the document already on the
     * canvas — `app.clean()` from Clear Workflow mints a new root id without
     * going through a graph load. Not a document transition: the uid is
     * unchanged, so a stale id here would make every later agent op look like
     * it targets a foreign graph.
     */
    function rebindActiveRootGraph(rootGraphId: RootGraphId): void {
      const current = activeBinding.value
      if (current === null || current.rootGraphId === rootGraphId) return
      activeBinding.value = { uid: current.uid, rootGraphId }
    }

    // Compare against a non-null binding explicitly: `binding?.uid === uid`
    // reads as true when *both* sides are undefined, so an undefined uid would
    // report itself active against no binding at all.
    function isActive(uid: DocumentUid): boolean {
      const binding = activeBinding.value
      return binding !== null && binding.uid === uid
    }

    function activeRootGraphId(uid: DocumentUid): RootGraphId | null {
      const binding = activeBinding.value
      return binding !== null && binding.uid === uid
        ? binding.rootGraphId
        : null
    }

    function $reset(): void {
      activeBinding.value = null
      latestTransition = 0 as DocumentTransition
    }

    return {
      beginTransition,
      activate,
      invalidate,
      rebindActiveRootGraph,
      isActive,
      activeRootGraphId,
      $reset
    }
  }
)
