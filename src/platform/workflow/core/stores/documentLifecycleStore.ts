import { defineStore } from 'pinia'
import { shallowRef } from 'vue'

import { useWorkflowStore } from '@/platform/workflow/management/stores/workflowStore'
import type { RootGraphId } from '@/types/graphScopeId'

export type DocumentUid = string & { readonly __brand: 'DocumentUid' }

export function toDocumentUid(value: string): DocumentUid {
  return value as DocumentUid
}

/**
 * Names one graph load. A load hands its token to `activate` or `invalidate` so
 * those calls cannot publish on a newer load's behalf: `loadGraphData` callers
 * such as `ChangeTracker.undo` bypass the workflow-load queue, so loads can
 * interleave and mutate the shared graph. The token does not serialize or cancel
 * those mutations — a superseded load still rewrites the canvas — so a stale
 * token means the binding can no longer be trusted, not that nothing happened.
 */
export type DocumentTransition = number & {
  readonly __brand: 'DocumentTransition'
}

/**
 * Owns the one fact that the shared canvas cannot answer for itself: which root
 * graph the presented document is on, and when there is no valid answer yet.
 *
 * It deliberately does **not** own which document is presented.
 * `activeWorkflow` already owns that, and a second copy written in
 * load-completion order went stale against it, which silenced the agent's
 * follower after a close/reopen
 * (`browser_tests/tests/agent/agentCloseReopenRemoteDelete.spec.ts`). So
 * identity is read live from the active pointer, and only the root graph id is
 * stored.
 *
 * The root graph id cannot be read off `app.rootGraph.id` instead, which is why
 * this store exists at all: mid-load the canvas already holds the incoming
 * graph while the active pointer still names the outgoing document, and after a
 * failed load it holds neither. The stored id is published by the load that
 * succeeded, and follows an in-place rotation — `LGraph.clear()` mints a fresh
 * uuid with no document transition — through `rebindActiveRootGraph`.
 */
export const useDocumentLifecycleStore = defineStore(
  'documentLifecycle',
  () => {
    const activeRootGraph = shallowRef<RootGraphId | null>(null)
    let latestTransition = 0 as DocumentTransition

    function isLatest(transition: DocumentTransition): boolean {
      return transition === latestTransition
    }

    /**
     * The document currently presented on the canvas, per the active pointer,
     * or `undefined` when nothing is presented.
     */
    function presentedUid(): DocumentUid | undefined {
      const active = useWorkflowStore().activeWorkflow
      return active ? toDocumentUid(active.instanceId) : undefined
    }

    /**
     * Open a graph load, retracting the current binding unless the load is
     * staying on the document already presented. Undo, redo, and same-document
     * reloads keep their binding; everything else — including an import, which
     * has no requested document — fails closed until the load publishes.
     */
    function beginTransition(nextUid: DocumentUid | null): DocumentTransition {
      latestTransition = (latestTransition + 1) as DocumentTransition
      // Compared against the live pointer, not against the last published uid:
      // the pointer has not moved yet at `beforeLoadNewGraph`, so it is the
      // outgoing document, and it is the only reading that cannot be stale.
      // `?? null` so "nothing presented, nothing requested" is not a change.
      if ((presentedUid() ?? null) !== nextUid) activeRootGraph.value = null
      return latestTransition
    }

    /**
     * Publish the root graph the load settled the presented document onto.
     *
     * A superseded load retracts instead of publishing. It cannot publish — a
     * newer load already did — but it has by now run `clean()` and `configure()`
     * on the shared graph, so the newer load's published id no longer names
     * what is on the canvas either. Neither answer is true, so there is none.
     */
    function activate(
      rootGraphId: RootGraphId,
      transition: DocumentTransition
    ): void {
      activeRootGraph.value = isLatest(transition) ? rootGraphId : null
    }

    /**
     * Retract the binding for a load that cleared the graph and then failed.
     *
     * Takes no token, unlike `activate`. A superseded load reaching here has
     * cleared the shared graph as well, so there is no reading of the
     * interleaving under which the current binding is still true — which is the
     * same reason `activate` retracts on a stale token.
     */
    function invalidate(): void {
      activeRootGraph.value = null
    }

    /**
     * Follow an in-place root graph id rotation on the document already on the
     * canvas — `app.clean()` from Clear Workflow mints a new root id without
     * going through a graph load. Not a document transition, so it must not
     * publish on its own: a stale id here would make every later agent op look
     * like it targets a foreign graph, but reviving a retracted binding would
     * hand the agent a graph no load ever vouched for.
     */
    function rebindActiveRootGraph(rootGraphId: RootGraphId): void {
      if (activeRootGraph.value === null) return
      activeRootGraph.value = rootGraphId
    }

    // `undefined` must not match an absent pointer: on its own
    // `presentedUid() === uid` is true when both sides are undefined.
    function isActive(uid: DocumentUid | undefined): boolean {
      return activeRootGraphId(uid) !== null
    }

    function activeRootGraphId(
      uid: DocumentUid | undefined
    ): RootGraphId | null {
      if (uid === undefined) return null
      return presentedUid() === uid ? activeRootGraph.value : null
    }

    function $reset(): void {
      activeRootGraph.value = null
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
