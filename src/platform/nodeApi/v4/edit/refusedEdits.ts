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

const TYPES_WHOSE_WIDGETS_HOLD_USER_CONTENT = new Set([
  'Note',
  'MarkdownNote',
  'PrimitiveNode'
])

/** Refuses turning widget saving off on a Note, a MarkdownNote or a PrimitiveNode. */
export function assertWidgetSavingKept(member: string, node: LGraphNode): void {
  if (TYPES_WHOSE_WIDGETS_HOLD_USER_CONTENT.has(node.type)) {
    throw invalidArgument(
      member,
      'a node that is not a Note, MarkdownNote or PrimitiveNode, to stop saving its widget values',
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
