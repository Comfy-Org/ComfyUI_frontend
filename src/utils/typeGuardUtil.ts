import { LGraphNode } from '@comfyorg/litegraph'

import type { PrimitiveNode } from '@/extensions/core/widgetInputs'

export function isPrimitiveNode(
  node: LGraphNode
): node is PrimitiveNode & LGraphNode {
  return node.type === 'PrimitiveNode'
}
