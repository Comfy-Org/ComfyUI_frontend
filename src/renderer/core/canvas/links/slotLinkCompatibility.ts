import { getActivePinia } from 'pinia'

import type {
  INodeInputSlot,
  INodeOutputSlot
} from '@/lib/litegraph/src/interfaces'
import type { LGraphNode, NodeId } from '@/lib/litegraph/src/litegraph'
import { useCanvasStore } from '@/renderer/core/canvas/canvasStore'
import type {
  SlotDragSource,
  SlotDropCandidate
} from '@/renderer/core/canvas/links/slotLinkDragState'
import { app } from '@/scripts/app'

interface CompatibilityResult {
  allowable: boolean
  targetNode?: LGraphNode
  targetSlot?: INodeInputSlot | INodeOutputSlot
}

function resolveNode(nodeId: NodeId) {
  const pinia = getActivePinia()
  const canvasStore = pinia ? useCanvasStore() : null
  const graph = canvasStore?.canvas?.graph ?? app.canvas?.graph
  if (!graph) return null
  const id = typeof nodeId === 'string' ? Number(nodeId) : nodeId
  if (Number.isNaN(id)) return null
  return graph.getNodeById(id)
}

export function evaluateCompatibility(
  source: SlotDragSource,
  candidate: SlotDropCandidate
): CompatibilityResult {
  const sourceNode = resolveNode(source.nodeId)
  const targetNode = resolveNode(candidate.layout.nodeId)
  if (!sourceNode || !targetNode) {
    return { allowable: false }
  }

  if (source.type === 'output') {
    if (candidate.layout.type !== 'input') {
      return { allowable: false }
    }

    const outputSlot = sourceNode.outputs?.[source.slotIndex]
    const inputSlot = targetNode.inputs?.[candidate.layout.index]
    if (!outputSlot || !inputSlot) {
      return { allowable: false }
    }

    const allowable = sourceNode.canConnectTo(targetNode, inputSlot, outputSlot)
    return { allowable, targetNode, targetSlot: inputSlot }
  }

  if (source.type === 'input') {
    if (candidate.layout.type === 'output') {
      const inputSlot = sourceNode.inputs?.[source.slotIndex]
      const outputSlot = targetNode.outputs?.[candidate.layout.index]
      if (!inputSlot || !outputSlot) {
        return { allowable: false }
      }

      const allowable = targetNode.canConnectTo(
        sourceNode,
        inputSlot,
        outputSlot
      )
      return { allowable, targetNode, targetSlot: outputSlot }
    }

    if (candidate.layout.type === 'input') {
      const graph = sourceNode.graph
      if (!graph) {
        return { allowable: false }
      }

      const linkId = source.linkId
      if (linkId == null) {
        return { allowable: false }
      }

      const link = graph.getLink(linkId)
      if (!link) {
        return { allowable: false }
      }

      const outputNode = resolveNode(link.origin_id)
      const outputSlot = outputNode?.outputs?.[link.origin_slot]
      const inputSlotTarget = targetNode.inputs?.[candidate.layout.index]
      if (!outputNode || !outputSlot || !inputSlotTarget) {
        return { allowable: false }
      }

      const allowable = outputNode.canConnectTo(
        targetNode,
        inputSlotTarget,
        outputSlot
      )
      return { allowable, targetNode, targetSlot: inputSlotTarget }
    }
  }

  return { allowable: false }
}
