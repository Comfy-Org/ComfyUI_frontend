import { defineStore } from 'pinia'
import { shallowRef } from 'vue'

import { useWorkflowStore } from '@/platform/workflow/management/stores/workflowStore'
import type { RootGraphId } from '@/types/graphScopeId'

export type DocumentUid = string & { readonly __brand: 'DocumentUid' }

export function toDocumentUid(value: string): DocumentUid {
  return value as DocumentUid
}

/** Token for one graph load; `activate` honours only the latest one. */
export type DocumentTransition = number & {
  readonly __brand: 'DocumentTransition'
}

/**
 * Root graph id of the document presented on the canvas, or null until a load
 * publishes one.
 */
export const useDocumentLifecycleStore = defineStore(
  'documentLifecycle',
  () => {
    const activeRootGraph = shallowRef<RootGraphId | null>(null)
    let latestTransition = 0 as DocumentTransition

    function isLatest(transition: DocumentTransition): boolean {
      return transition === latestTransition
    }

    function presentedUid(): DocumentUid | undefined {
      const active = useWorkflowStore().activeWorkflow
      return active ? toDocumentUid(active.instanceId) : undefined
    }

    /** Retracts unless the load stays on the presented document. */
    function beginTransition(nextUid: DocumentUid | null): DocumentTransition {
      latestTransition = (latestTransition + 1) as DocumentTransition
      if ((presentedUid() ?? null) !== nextUid) activeRootGraph.value = null
      return latestTransition
    }

    /** Publishes for the latest load; a superseded load retracts instead. */
    function activate(
      rootGraphId: RootGraphId,
      transition: DocumentTransition
    ): void {
      activeRootGraph.value = isLatest(transition) ? rootGraphId : null
    }

    /** Retracts after a load that cleared the graph fails. */
    function invalidate(): void {
      activeRootGraph.value = null
    }

    /** Follows an in-place root id rotation; no-op while retracted. */
    function rebindActiveRootGraph(rootGraphId: RootGraphId): void {
      if (activeRootGraph.value === null) return
      activeRootGraph.value = rootGraphId
    }

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
