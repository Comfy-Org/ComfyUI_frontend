import { defineStore } from 'pinia'
import { shallowRef } from 'vue'

import { useWorkflowStore } from '@/platform/workflow/management/stores/workflowStore'
import type { RootGraphId } from '@/types/graphScopeId'

export type DocumentUid = string & { readonly __brand: 'DocumentUid' }

export function toDocumentUid(value: string): DocumentUid {
  return value as DocumentUid
}

/**
 * Root graph id of the document presented on the canvas, or null until a load
 * publishes one.
 */
export const useDocumentLifecycleStore = defineStore(
  'documentLifecycle',
  () => {
    const activeRootGraph = shallowRef<RootGraphId | null>(null)

    function presentedUid(): DocumentUid | undefined {
      const active = useWorkflowStore().activeWorkflow
      return active ? toDocumentUid(active.instanceId) : undefined
    }

    /** Retracts unless the load stays on the presented document. */
    function beginTransition(nextUid: DocumentUid | null): void {
      if ((presentedUid() ?? null) !== nextUid) activeRootGraph.value = null
    }

    function activate(rootGraphId: RootGraphId): void {
      activeRootGraph.value = rootGraphId
    }

    function invalidate(): void {
      activeRootGraph.value = null
    }

    /** Follows an in-place root id rotation; no-op while retracted. */
    function rebindActiveRootGraph(rootGraphId: RootGraphId): void {
      if (activeRootGraph.value === null) return
      activeRootGraph.value = rootGraphId
    }

    function activeRootGraphId(
      uid: DocumentUid | undefined
    ): RootGraphId | null {
      if (uid === undefined) return null
      return presentedUid() === uid ? activeRootGraph.value : null
    }

    function $reset(): void {
      activeRootGraph.value = null
    }

    return {
      beginTransition,
      activate,
      invalidate,
      rebindActiveRootGraph,
      activeRootGraphId,
      $reset
    }
  }
)
