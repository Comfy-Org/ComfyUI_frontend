import type { LGraphNode } from '@/lib/litegraph/src/litegraph'

/** Narrowed type for nodes identified as PrimitiveNode by type string check. */
interface PrimitiveNodeLike extends LGraphNode {
  recreateWidget(): void
  onLastDisconnect(): void
}

export const isPrimitiveNode = (node: LGraphNode): node is PrimitiveNodeLike =>
  node.type === 'PrimitiveNode'
