import { toNodeId } from '@comfyorg/graph-model/nodeId'

import type { LGraph } from '@/lib/litegraph/src/LGraph'
import type { LGraphNode } from '@/lib/litegraph/src/LGraphNode'

import type {
  DocumentHandles,
  GraphResolver
} from '@/platform/nodeApi/shared/documentHandles'
import type { NodeHandles } from '@/platform/nodeApi/v4/nodeHandle'
import type {
  InputSlotHandle,
  OutputSlotHandle
} from '@/platform/nodeApi/v4/types'
import type { EditCore } from './edits'
import type { LiveSlot, SlotHandles, SlotLocator, SlotPlace } from './liveSlot'
import { inputSlotHandle, outputSlotHandle } from './slotHandle'
import { knownSlotId, slotIdOf } from './slotIds'

export function createSlotHandles(
  handles: DocumentHandles,
  nodes: NodeHandles,
  edits: () => EditCore
): SlotHandles {
  const locators = new WeakMap<object, SlotLocator>()
  const inputs = handles.createCache<InputSlotHandle>((graph, key) =>
    slotIsOnNode(graph, key, (node) => node.inputs)
  )
  const outputs = handles.createCache<OutputSlotHandle>((graph, key) =>
    slotIsOnNode(graph, key, (node) => node.outputs)
  )

  const slots: SlotHandles = {
    inputHandle: (graph, node, slot) =>
      inputs.handleFor(graph, keyOf(node, slot), (resolveGraph) => {
        const locate = (): LiveSlot | undefined => {
          const place = placeOf(resolveGraph, node.id, slot, (it) => it.inputs)
          return place && { ...place, side: 'input', slot }
        }
        const context = { edits, nodes, slots, locate }
        const handle = inputSlotHandle(slotIdOf(slot), context)
        locators.set(handle, { side: 'input', locate })
        return handle
      }),
    outputHandle: (graph, node, slot) =>
      outputs.handleFor(graph, keyOf(node, slot), (resolveGraph) => {
        const locate = (): LiveSlot | undefined => {
          const place = placeOf(resolveGraph, node.id, slot, (it) => it.outputs)
          return place && { ...place, side: 'output', slot }
        }
        const context = { edits, nodes, slots, locate }
        const handle = outputSlotHandle(slotIdOf(slot), context)
        locators.set(handle, { side: 'output', locate })
        return handle
      }),
    locator: (value) =>
      typeof value === 'object' && value !== null
        ? locators.get(value)
        : undefined
  }
  return slots
}

const KEY_SEPARATOR = '#'

function keyOf(node: LGraphNode, slot: object): string {
  return `${slotIdOf(slot)}${KEY_SEPARATOR}${node.id}`
}

function slotIsOnNode(
  graph: LGraph,
  key: string,
  slotsOf: (node: LGraphNode) => readonly object[]
): boolean {
  const separator = key.indexOf(KEY_SEPARATOR)
  const id = key.slice(0, separator)
  const node = graph.getNodeById(toNodeId(key.slice(separator + 1)))
  return !!node && slotsOf(node).some((slot) => knownSlotId(slot) === id)
}

function placeOf<TSlot>(
  resolveGraph: GraphResolver,
  nodeId: LGraphNode['id'],
  slot: TSlot,
  slotsOf: (node: LGraphNode) => readonly TSlot[]
): SlotPlace | undefined {
  const graph = resolveGraph()
  const node = graph?.getNodeById(nodeId)
  const index = node ? slotsOf(node).indexOf(slot) : -1
  return graph && node && index !== -1 ? { graph, node, index } : undefined
}
