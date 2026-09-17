import type { LinkId } from '@/types/linkId'
import { toLinkId } from '@/types/linkId'
import type { LinkTopology } from '@/types/linkTopology'
import type { NodeId } from '@/types/nodeId'
import type { NodeState } from '@/types/nodeState'

import { isRecord } from './prepare'

/**
 * A supplied input slot whose record has no `link` key carries no link
 * information (as opposed to `link: null`, which means unlinked). Such slots
 * keep the link of the `existing` slot at the same index, or `null` when the
 * node has no slot there yet.
 */
export function prepareInputSlots(
  value: unknown,
  existing?: NodeState['inputs']
): NodeState['inputs'] {
  if (!Array.isArray(value)) return []
  return value.filter(isRecord).map((raw, index) => {
    const slot = structuredClone(raw)
    if (typeof slot.link === 'number') slot.link = toLinkId(slot.link)
    if (slot.link === undefined) slot.link = existing?.[index]?.link ?? null
    return {
      ...slot,
      boundingRect: [0, 0, 0, 0]
    } as unknown as NodeState['inputs'][number]
  })
}
export function prepareOutputSlots(value: unknown): NodeState['outputs'] {
  if (!Array.isArray(value)) return []
  return value.filter(isRecord).map((raw) => {
    const slot = structuredClone(raw)
    if (Array.isArray(slot.links)) {
      slot.links = slot.links.map((id) => toLinkId(Number(id)))
    }
    return {
      ...slot,
      boundingRect: [0, 0, 0, 0]
    } as unknown as NodeState['outputs'][number]
  })
}
export function reconcileInputSlots(
  current: NodeState,
  next: Pick<NodeState, 'inputs' | 'properties'>
): NodeState['inputs'] {
  const promoted = new Map(
    current.inputs
      .filter((input) => '_subgraphSlot' in input && input._subgraphSlot)
      .map((input) => [input.name, input])
  )
  const inputs = next.inputs.map((input) => {
    const existing = promoted.get(input.name)
    promoted.delete(input.name)
    const { link: _link, boundingRect: _bounds, ...metadata } = input
    return existing?.type === input.type
      ? Object.assign(existing, metadata)
      : input
  })
  return Array.isArray(next.properties.proxyWidgets)
    ? [...inputs, ...promoted.values()]
    : inputs
}
export function nodeKey(nodeId: NodeId): string {
  return String(nodeId)
}
export function detachedLinkSlots(
  nodes: Iterable<NodeState>,
  topology: LinkTopology
): Map<NodeId, Pick<NodeState, 'inputs' | 'outputs'>> {
  const nodesById = new Map([...nodes].map((node) => [nodeKey(node.id), node]))
  const changed = new Map<NodeId, Pick<NodeState, 'inputs' | 'outputs'>>()
  const slotsFor = (node: NodeState) => {
    const prior = changed.get(node.id)
    if (prior) return prior
    const slots = { inputs: node.inputs, outputs: node.outputs }
    changed.set(node.id, slots)
    return slots
  }

  const origin = nodesById.get(nodeKey(topology.originNodeId))
  if (origin?.outputs[topology.originSlot]) {
    const slots = slotsFor(origin)
    slots.outputs = slots.outputs.map((output, index) =>
      index === topology.originSlot
        ? {
            ...output,
            links: output.links?.filter((id) => id !== topology.id) ?? null
          }
        : output
    )
  }

  const target = nodesById.get(nodeKey(topology.targetNodeId))
  if (target?.inputs[topology.targetSlot]?.link === topology.id) {
    const slots = slotsFor(target)
    slots.inputs = slots.inputs.map((input, index) =>
      index === topology.targetSlot ? { ...input, link: null } : input
    )
  }

  return changed
}
export function removeIncidentLinks(
  nodes: Map<string, NodeState>,
  links: Map<LinkId, LinkTopology>,
  nodeId: NodeId
): void {
  for (const [id, topology] of [...links]) {
    if (topology.originNodeId === nodeId || topology.targetNodeId === nodeId) {
      removeSimulatedLink(nodes, links, id)
    }
  }
}
export function removeSimulatedLink(
  nodes: Map<string, NodeState>,
  links: Map<LinkId, LinkTopology>,
  linkId: LinkId
): void {
  const topology = links.get(linkId)
  if (!topology) return
  links.delete(linkId)
  for (const [nodeId, slots] of detachedLinkSlots(nodes.values(), topology)) {
    const node = nodes.get(nodeKey(nodeId))
    if (node) nodes.set(nodeKey(nodeId), { ...node, ...slots })
  }
}
