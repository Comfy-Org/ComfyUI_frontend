import { useChainCallback } from '@/composables/functional/useChainCallback'
import type { LGraph, LGraphNode } from '@/lib/litegraph/src/litegraph'
import { useLayoutMutations } from '@/renderer/core/layout/operations/layoutMutations'
import { layoutStore } from '@/renderer/core/layout/store/layoutStore'
import { LayoutSource } from '@/renderer/core/layout/types'

export function useGraphLayoutManager(graph: LGraph): () => void {
  const { createNode, deleteNode, setSource } = useLayoutMutations()

  const createMissingLayout = (node: LGraphNode) => {
    if (!graph.getNodeById(node.id)) return

    const existingLayout = layoutStore.getNodeLayoutRef(node.id).value
    if (existingLayout) return

    setSource(LayoutSource.Canvas)
    createNode(node.id, {
      position: { x: node.pos[0], y: node.pos[1] },
      size: { width: node.size[0], height: node.size[1] },
      zIndex: node.order || 0,
      visible: true
    })
  }

  const handleNodeAdded = (
    node: LGraphNode,
    originalCallback?: (node: LGraphNode) => void
  ) => {
    if (window.app?.configuringGraph) {
      node.onAfterGraphConfigured = useChainCallback(
        node.onAfterGraphConfigured,
        () => createMissingLayout(node)
      )
    } else {
      createMissingLayout(node)
    }

    originalCallback?.(node)
  }

  const handleNodeRemoved = (
    node: LGraphNode,
    originalCallback?: (node: LGraphNode) => void
  ) => {
    setSource(LayoutSource.Canvas)
    deleteNode(node.id)
    originalCallback?.(node)
  }

  const originalOnNodeAdded = graph.onNodeAdded
  const originalOnNodeRemoved = graph.onNodeRemoved

  graph.onNodeAdded = (node: LGraphNode) => {
    handleNodeAdded(node, originalOnNodeAdded)
  }

  graph.onNodeRemoved = (node: LGraphNode) => {
    handleNodeRemoved(node, originalOnNodeRemoved)
  }

  return () => {
    graph.onNodeAdded = originalOnNodeAdded || undefined
    graph.onNodeRemoved = originalOnNodeRemoved || undefined
  }
}
