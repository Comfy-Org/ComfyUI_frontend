import type { LGraph } from '@/lib/litegraph/src/LGraph'
import type { LGraphNode } from '@/lib/litegraph/src/LGraphNode'

import type { DocumentHandles } from '@/platform/nodeApi/shared/documentHandles'
import type { NodeHandles } from '@/platform/nodeApi/v4/nodeHandle'
import type {
  InputSlotHandle,
  OutputSlotHandle
} from '@/platform/nodeApi/v4/types'
import type { EditCore } from './edits'
import type { LiveSlot, SlotHandles, SlotPlace } from './liveSlot'
import { inputSlotHandle, outputSlotHandle } from './slotHandle'
import { slotIdOf } from './slotIds'

export function createSlotHandles(
  handles: DocumentHandles,
  nodes: NodeHandles,
  edits: () => EditCore
): SlotHandles {
  const inputs = handles.createCache<InputSlotHandle, LiveSlot>()
  const outputs = handles.createCache<OutputSlotHandle, LiveSlot>()

  const slots: SlotHandles = {
    inputHandle: (graph, node, slot) =>
      inputs.handleFor(
        graph,
        keyOf(node, slot),
        (current) => {
          const place = placeOf(current, node.id, slot, (it) => it.inputs)
          return place && { ...place, side: 'input', slot }
        },
        (locate) =>
          inputSlotHandle(slotIdOf(slot), { edits, nodes, slots, locate })
      ),
    outputHandle: (graph, node, slot) =>
      outputs.handleFor(
        graph,
        keyOf(node, slot),
        (current) => {
          const place = placeOf(current, node.id, slot, (it) => it.outputs)
          return place && { ...place, side: 'output', slot }
        },
        (locate) =>
          outputSlotHandle(slotIdOf(slot), { edits, nodes, slots, locate })
      ),
    locator(value) {
      const input = inputs.locator(value)
      if (input) return { side: 'input', locate: input }
      const output = outputs.locator(value)
      return output && { side: 'output', locate: output }
    }
  }
  return slots
}

function keyOf(node: LGraphNode, slot: object): string {
  return `${slotIdOf(slot)}#${node.id}`
}

function placeOf<TSlot>(
  graph: LGraph,
  nodeId: LGraphNode['id'],
  slot: TSlot,
  slotsOf: (node: LGraphNode) => readonly TSlot[]
): SlotPlace | undefined {
  const node = graph.getNodeById(nodeId)
  const index = node ? slotsOf(node).indexOf(slot) : -1
  return node && index !== -1 ? { graph, node, index } : undefined
}
