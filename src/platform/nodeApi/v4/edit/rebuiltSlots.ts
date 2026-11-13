import { ComfyNodeDefImpl } from '@/core/graph/nodeDef/ComfyNodeDefImpl'
import type { LGraphNode } from '@/lib/litegraph/src/LGraphNode'

import { invalidArgument } from '@/platform/nodeApi/shared/invalidArgument'
import type { SlotSide } from '@/platform/nodeApi/v4/types'
import type { LiveSlot } from './liveSlot'

const REBUILT_FIELDS = new Set([
  'name',
  'type',
  'shape',
  'localizedName',
  'widget'
])

/** Refuses a slot edit a load would not keep: a rebuilt field of a declared slot, or any slot of a subgraph node. */
export function assertSlotEditKept(
  member: string,
  live: LiveSlot,
  fields: readonly string[]
): void {
  assertNotSubgraphNode(member, live.node)
  const rebuilt = fields.filter((field) => REBUILT_FIELDS.has(field))
  if (rebuilt.length > 0 && isDeclared(live)) {
    throw invalidArgument(
      member,
      'a slot the node type does not declare, to change its name, type, shape, localizedName or widget',
      live.slot.name
    )
  }
}

/** Refuses removing a slot a load would bring back. */
export function assertRemovalKept(member: string, live: LiveSlot): void {
  assertNotSubgraphNode(member, live.node)
  if (isDeclared(live)) {
    throw invalidArgument(
      member,
      'a slot the node type does not declare',
      live.slot.name
    )
  }
}

/** Refuses a reorder that moves a slot the node type declares, which a load puts back. */
export function assertReorderKept(
  member: string,
  node: LGraphNode,
  side: SlotSide,
  from: readonly number[]
): void {
  const moved = from.findIndex(
    (was, now) =>
      was !== now &&
      isDeclaredAt(
        node,
        side,
        was,
        side === 'input' ? node.inputs : node.outputs
      )
  )
  if (moved !== -1) {
    throw invalidArgument(
      member,
      'an order that keeps every slot the node type declares in its place',
      from.join(', ')
    )
  }
}

/** Refuses a slot edit on a subgraph node, whose slots are its subgraph's inputs and outputs. */
export function assertNotSubgraphNode(member: string, node: LGraphNode): void {
  if (node.isSubgraphNode()) {
    throw invalidArgument(
      member,
      "a node that is not a subgraph node (a subgraph node's slots are its subgraph's inputs and outputs)",
      node.type
    )
  }
}

/** True for a node of a backend type, whose declared slots and widget saving a load rebuilds. */
export function isBackendTypeNode(node: LGraphNode): boolean {
  return node.constructor.nodeData instanceof ComfyNodeDefImpl
}

function isDeclared({ node, side, index }: LiveSlot): boolean {
  return isDeclaredAt(
    node,
    side,
    index,
    side === 'input' ? node.inputs : node.outputs
  )
}

function isDeclaredAt(
  node: LGraphNode,
  side: SlotSide,
  index: number,
  slots: readonly { readonly name: string }[]
): boolean {
  const definition = node.constructor.nodeData
  if (!(definition instanceof ComfyNodeDefImpl)) return false
  return side === 'input'
    ? Object.hasOwn(definition.inputs, slots[index].name)
    : index < definition.outputs.length
}
