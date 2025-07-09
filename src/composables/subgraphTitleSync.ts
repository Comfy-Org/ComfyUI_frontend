import type { LGraphNode } from '@comfyorg/litegraph'

import { useWorkflowStore } from '@/stores/workflowStore'

/**
 * Composable for synchronizing subgraph titles across different data structures
 */
export const useSubgraphTitleSync = () => {
  const workflowStore = useWorkflowStore()

  /**
   * Updates the subgraph's runtime name for breadcrumb reactivity
   */
  const updateSubgraphName = (subgraph: any, newName: string) => {
    subgraph.name = newName
  }

  /**
   * Updates the exported subgraph definition for persistence
   */
  const updateExportedSubgraphName = (subgraphId: string, newName: string) => {
    const activeWorkflow = workflowStore.activeWorkflow
    if (activeWorkflow?.activeState?.definitions?.subgraphs) {
      const exportedSubgraph =
        activeWorkflow.activeState.definitions.subgraphs.find(
          (s: any) => s.id === subgraphId
        )
      if (exportedSubgraph) {
        exportedSubgraph.name = newName
      }
    }
  }

  /**
   * Synchronizes subgraph title across all data structures
   */
  const syncSubgraphTitle = (subgraphNode: LGraphNode, newTitle: string) => {
    if (!subgraphNode.isSubgraphNode?.()) {
      return
    }

    updateSubgraphName(subgraphNode.subgraph, newTitle)
    updateExportedSubgraphName(subgraphNode.subgraph.id, newTitle)
  }

  return {
    updateSubgraphName,
    updateExportedSubgraphName,
    syncSubgraphTitle
  }
}
