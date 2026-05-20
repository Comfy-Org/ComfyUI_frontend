import type { PrimitiveNode } from '@/extensions/core/widgetInputs'
import type { LGraphNode } from '@/lib/litegraph/src/litegraph'

export function isPrimitiveNode(
  node: LGraphNode
): node is PrimitiveNode & LGraphNode {
  return node.type === 'PrimitiveNode'
}
