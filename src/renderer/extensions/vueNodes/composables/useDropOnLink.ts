import { onScopeDispose, ref } from 'vue'

import type { LGraph } from '@/lib/litegraph/src/LGraph'
import type { LGraphNode } from '@/lib/litegraph/src/LGraphNode'
import type { LLink } from '@/lib/litegraph/src/LLink'
import { LiteGraph } from '@/lib/litegraph/src/litegraph'
import { useVueNodeLifecycle } from '@/composables/graph/useVueNodeLifecycle'
import { useCanvasStore } from '@/renderer/core/canvas/canvasStore'
import { graphInteractionHooks } from '@/renderer/core/canvas/hooks/graphInteractionHooks'
import { layoutStore } from '@/renderer/core/layout/store/layoutStore'
import type { LinkId, NodeId, Point } from '@/renderer/core/layout/types'
import { app } from '@/scripts/app'

interface DropTarget {
  link: LLink
  inputSlotIndex: number
  outputSlotIndex: number
}

export function useDropOnLink() {
  const hoveredLinkId = ref<LinkId | null>(null)
  const { nodeManager } = useVueNodeLifecycle()
  const canvasStore = useCanvasStore()

  let currentTarget: DropTarget | null = null

  function getGraph(): LGraph | null {
    return app.canvas?.graph ?? null
  }

  function getNode(nodeId: NodeId): LGraphNode | null {
    return nodeManager.value?.getNode(nodeId) ?? null
  }

  function nodeHasConnections(node: LGraphNode): boolean {
    if (node.inputs?.some((input) => input.link != null)) return true
    if (node.outputs?.some((output) => (output.links?.length ?? 0) > 0))
      return true
    return false
  }

  function findFirstMatchingInputSlot(
    node: LGraphNode,
    linkType: string | number
  ): number {
    if (!node.inputs) return -1
    for (const [index, input] of node.inputs.entries()) {
      if (input.link != null) continue
      if (LiteGraph.isValidConnection(linkType, input.type)) return index
    }
    return -1
  }

  function findFirstMatchingOutputSlot(
    node: LGraphNode,
    linkType: string | number
  ): number {
    if (!node.outputs) return -1
    for (const [index, output] of node.outputs.entries()) {
      if (LiteGraph.isValidConnection(output.type, linkType)) return index
    }
    return -1
  }

  function resolveDropTarget(
    draggedNode: LGraphNode,
    canvasPos: Point
  ): DropTarget | null {
    const graph = getGraph()
    if (!graph) return null

    const ctx = canvasStore.canvas?.ctx
    const linkId = layoutStore.queryLinkAtPoint(canvasPos, ctx ?? undefined)
    if (linkId == null) return null

    const link = graph._links.get(linkId)
    if (!link) return null
    if (link.origin_id === draggedNode.id) return null
    if (link.target_id === draggedNode.id) return null

    const linkType = link.type ?? ''
    const inputSlotIndex = findFirstMatchingInputSlot(draggedNode, linkType)
    if (inputSlotIndex === -1) return null

    const outputSlotIndex = findFirstMatchingOutputSlot(draggedNode, linkType)
    if (outputSlotIndex === -1) return null

    return { link, inputSlotIndex, outputSlotIndex }
  }

  function setHighlight(linkId: LinkId | null) {
    if (hoveredLinkId.value === linkId) return

    const canvas = canvasStore.canvas
    if (canvas) {
      if (hoveredLinkId.value != null) {
        delete canvas.highlighted_links[hoveredLinkId.value]
      }
      if (linkId != null) {
        canvas.highlighted_links[linkId] = true
      }
      canvas.setDirty(true)
    }

    hoveredLinkId.value = linkId
  }

  function handleNodeDragMove(event: {
    nodeId: NodeId
    canvasPos: Point
    selectionSize: number
  }) {
    if (event.selectionSize > 1) {
      currentTarget = null
      setHighlight(null)
      return
    }

    const node = getNode(event.nodeId)
    if (!node || nodeHasConnections(node)) {
      currentTarget = null
      setHighlight(null)
      return
    }

    const target = resolveDropTarget(node, event.canvasPos)
    currentTarget = target
    setHighlight(target?.link.id ?? null)
  }

  function applyDrop(draggedNode: LGraphNode, target: DropTarget) {
    const graph = getGraph()
    if (!graph) return

    const sourceNode = graph.getNodeById(target.link.origin_id)
    const sinkNode = graph.getNodeById(target.link.target_id)
    if (!sourceNode || !sinkNode) return

    graph.beforeChange()
    try {
      sinkNode.disconnectInput(target.link.target_slot, true)
      sourceNode.connect(
        target.link.origin_slot,
        draggedNode,
        target.inputSlotIndex
      )
      draggedNode.connect(
        target.outputSlotIndex,
        sinkNode,
        target.link.target_slot
      )
    } finally {
      graph.afterChange()
    }
  }

  function handleNodeDragEnd(event: { nodeId: NodeId }) {
    const target = currentTarget
    currentTarget = null
    setHighlight(null)

    if (!target) return

    const node = getNode(event.nodeId)
    if (!node || nodeHasConnections(node)) return

    applyDrop(node, target)
  }

  const unsubscribeMove = graphInteractionHooks.on(
    'nodeDragMove',
    handleNodeDragMove
  )
  const unsubscribeEnd = graphInteractionHooks.on(
    'nodeDragEnd',
    handleNodeDragEnd
  )

  onScopeDispose(() => {
    unsubscribeMove()
    unsubscribeEnd()
    setHighlight(null)
  })

  return { hoveredLinkId }
}
