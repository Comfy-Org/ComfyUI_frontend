import { useSelectedLiteGraphItems } from '@/composables/canvas/useSelectedLiteGraphItems'
import { SubgraphNode } from '@/lib/litegraph/src/litegraph'
import { useWorkflowStore } from '@/platform/workflow/management/stores/workflowStore'
import { useCanvasStore } from '@/renderer/core/canvas/canvasStore'
import { useNodeOutputStore } from '@/stores/imagePreviewStore'
import { useNodeBookmarkStore } from '@/stores/nodeBookmarkStore'
import { useNodeDefStore } from '@/stores/nodeDefStore'
import { isLGraphNode } from '@/utils/litegraphUtil'

/**
 * Composable for handling subgraph-related operations
 */
export function useSubgraphOperations() {
  const { getSelectedNodes } = useSelectedLiteGraphItems()
  const canvasStore = useCanvasStore()
  const workflowStore = useWorkflowStore()
  const nodeOutputStore = useNodeOutputStore()
  const nodeDefStore = useNodeDefStore()
  const nodeBookmarkStore = useNodeBookmarkStore()

  const convertToSubgraph = () => {
    const canvas = canvasStore.getCanvas()
    const graph = canvas.subgraph ?? canvas.graph
    if (!graph) {
      return null
    }

    const res = graph.convertToSubgraph(canvas.selectedItems)
    if (!res) {
      return
    }

    const { node } = res
    canvas.select(node)
    canvasStore.updateSelectedItems()
    // Trigger change tracking
    workflowStore.activeWorkflow?.changeTracker?.checkState()
  }

  const doUnpack = (
    subgraphNodes: SubgraphNode[],
    skipMissingNodes: boolean
  ) => {
    const canvas = canvasStore.getCanvas()
    const graph = canvas.subgraph ?? canvas.graph
    if (!graph) return

    for (const subgraphNode of subgraphNodes) {
      nodeOutputStore.revokeSubgraphPreviews(subgraphNode)
      graph.unpackSubgraph(subgraphNode, { skipMissingNodes })
    }
    workflowStore.activeWorkflow?.changeTracker?.checkState()
  }

  const unpackSubgraph = () => {
    const canvas = canvasStore.getCanvas()
    const graph = canvas.subgraph ?? canvas.graph

    if (!graph) {
      return
    }

    const selectedItems = [...canvas.selectedItems]
    const subgraphNodes = selectedItems.filter(
      (item): item is SubgraphNode => item instanceof SubgraphNode
    )

    if (subgraphNodes.length === 0) {
      return
    }
    doUnpack(subgraphNodes, true)
  }

  const addSubgraphToLibrary = async () => {
    const selectedItems = [...canvasStore.selectedItems]

    // Handle single node selection like BookmarkButton.vue
    if (selectedItems.length === 1) {
      const item = selectedItems[0]
      if (isLGraphNode(item)) {
        const nodeDef = nodeDefStore.fromLGraphNode(item)
        if (nodeDef) {
          await nodeBookmarkStore.addBookmark(nodeDef.nodePath)
          return
        }
      }
    }

    // Handle multiple nodes - convert to subgraph first then bookmark
    const selectedNodes = getSelectedNodes()

    if (selectedNodes.length === 0) {
      return
    }

    // Check if selection contains subgraph nodes
    const hasSubgraphs = selectedNodes.some(
      (node) => node instanceof SubgraphNode
    )

    if (!hasSubgraphs) {
      // Convert regular nodes to subgraph first
      convertToSubgraph()
      return
    }

    // For subgraph nodes, bookmark them
    let bookmarkedCount = 0
    for (const node of selectedNodes) {
      if (node instanceof SubgraphNode) {
        const nodeDef = nodeDefStore.fromLGraphNode(node)
        if (nodeDef) {
          await nodeBookmarkStore.addBookmark(nodeDef.nodePath)
          bookmarkedCount++
        }
      }
    }
  }

  const isSubgraphSelected = (): boolean => {
    const selectedItems = [...canvasStore.selectedItems]
    return selectedItems.some((item) => item instanceof SubgraphNode)
  }

  const hasSelectableNodes = (): boolean => {
    return getSelectedNodes().length > 0
  }

  return {
    convertToSubgraph,
    unpackSubgraph,
    addSubgraphToLibrary,
    isSubgraphSelected,
    hasSelectableNodes
  }
}
