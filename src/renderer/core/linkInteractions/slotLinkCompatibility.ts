import { getActivePinia } from 'pinia'

import type {
  INodeInputSlot,
  INodeOutputSlot
} from '@/lib/litegraph/src/interfaces'
import type { LGraphNode } from '@/lib/litegraph/src/litegraph'
import { useCanvasStore } from '@/renderer/core/canvas/canvasStore'
import type {
  SlotDragSource,
  SlotDropCandidate
} from '@/renderer/core/linkInteractions/slotLinkDragState'
import { app } from '@/scripts/app'

interface CompatibilityResult {
  allowable: boolean
  targetNode?: LGraphNode
  targetSlot?: INodeInputSlot | INodeOutputSlot
}

function resolveNode(nodeId: string | number) {
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
  if (candidate.layout.nodeId === source.nodeId) {
    return { allowable: false }
  }

  const isOutputToInput =
    source.type === 'output' && candidate.layout.type === 'input'
  const isInputToOutput =
    source.type === 'input' && candidate.layout.type === 'output'

  if (!isOutputToInput && !isInputToOutput) {
    return { allowable: false }
  }

  const sourceNode = resolveNode(source.nodeId)
  const targetNode = resolveNode(candidate.layout.nodeId)
  if (!sourceNode || !targetNode) {
    return { allowable: false }
  }

  const sourceSlot = isOutputToInput
    ? sourceNode.outputs?.[source.slotIndex]
    : sourceNode.inputs?.[source.slotIndex]
  const targetSlot = isOutputToInput
    ? targetNode.inputs?.[candidate.layout.index]
    : targetNode.outputs?.[candidate.layout.index]

  if (!sourceSlot || !targetSlot) {
    return { allowable: false }
  }

  if (isOutputToInput) {
    const outputSlot = sourceSlot as INodeOutputSlot | undefined
    const inputSlot = targetSlot as INodeInputSlot | undefined
    if (!outputSlot || !inputSlot) {
      return { allowable: false }
    }

    const allowable = sourceNode.canConnectTo(targetNode, inputSlot, outputSlot)
    return { allowable, targetNode, targetSlot: inputSlot }
  }

  const inputSlot = sourceSlot as INodeInputSlot | undefined
  const outputSlot = targetSlot as INodeOutputSlot | undefined
  if (!inputSlot || !outputSlot) {
    return { allowable: false }
  }

  const allowable = targetNode.canConnectTo(sourceNode, inputSlot, outputSlot)
  return { allowable, targetNode, targetSlot: outputSlot }
}
