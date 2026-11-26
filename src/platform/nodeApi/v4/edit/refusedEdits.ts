import type { LGraphNode } from '@/lib/litegraph/src/LGraphNode'

import { invalidArgument } from '@/platform/nodeApi/shared/invalidArgument'
import type { LiveSlot } from './liveSlot'

/** Refuses a slot edit on a subgraph node. */
export function assertNotSubgraphNode(member: string, node: LGraphNode): void {
  if (node.isSubgraphNode()) {
    throw invalidArgument(
      member,
      'a node that is not a subgraph node',
      node.type
    )
  }
}

/** Refuses turning widget saving off on a node whose type says its widget values are the user's content. */
export function assertWidgetSavingKept(member: string, node: LGraphNode): void {
  if (node.constructor.widgetsHoldUserContent === true) {
    throw invalidArgument(
      member,
      'a node whose widget values are not the user’s content, to stop saving them',
      node.type
    )
  }
}

/** Refuses a position for a slot that is, or the same patch makes, a widget's socket. */
export function assertPositionShown(
  member: string,
  live: LiveSlot,
  fields: readonly string[],
  widget: string | null | undefined
): void {
  if (!fields.includes('position')) return
  const isSocket =
    widget === undefined ? live.slot.widget !== undefined : widget !== null
  if (isSocket) {
    throw invalidArgument(
      member,
      "a slot that is not a widget's socket, to give it a position",
      live.slot.name
    )
  }
}
