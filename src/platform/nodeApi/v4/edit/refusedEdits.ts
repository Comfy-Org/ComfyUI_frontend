import type { LGraphNode } from '@/lib/litegraph/src/LGraphNode'

import { invalidArgument } from '@/platform/nodeApi/shared/invalidArgument'

/** Refuses a slot edit on a subgraph node: its slots are its subgraph's, which execution reads by position. */
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

/** Refuses turning widget saving off on a Note, a MarkdownNote or a PrimitiveNode, whose next load would erase what the user entered. */
export function assertWidgetSavingKept(member: string, node: LGraphNode): void {
  if (TYPES_WHOSE_WIDGETS_HOLD_USER_CONTENT.has(node.type)) {
    throw invalidArgument(
      member,
      'a node that is not a Note, MarkdownNote or PrimitiveNode, to stop saving its widget values',
      node.type
    )
  }
}
