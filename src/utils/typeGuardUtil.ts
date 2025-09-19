import type { PrimitiveNode } from '@/extensions/core/widgetInputs'
import type { LGraph, LGraphNode } from '@/lib/litegraph/src/litegraph'
import type { INodeSlot } from '@/lib/litegraph/src/litegraph'
import type { Subgraph } from '@/lib/litegraph/src/litegraph'

export function isPrimitiveNode(
  node: LGraphNode
): node is PrimitiveNode & LGraphNode {
  return node.type === 'PrimitiveNode'
}

/**
 * Check if an error is an AbortError triggered by `AbortController#abort`
 * when cancelling a request.
 */
export const isAbortError = (
  err: unknown
): err is DOMException & { name: 'AbortError' } =>
  err instanceof DOMException && err.name === 'AbortError'

export const isSubgraph = (
  item: LGraph | Subgraph | undefined | null
): item is Subgraph => item?.isRootGraph === false

/**
 * Check if an item is non-nullish.
 */
export const isNonNullish = <T>(item: T | undefined | null): item is T =>
  item != null

/**
 * Type guard to check if a node is a subgraph input/output node.
 * These nodes are essential to subgraph structure and should not be removed.
 */
export const isSubgraphIoNode = (
  node: LGraphNode
): node is LGraphNode & {
  constructor: { comfyClass: 'SubgraphInputNode' | 'SubgraphOutputNode' }
} => {
  const nodeClass = node.constructor?.comfyClass
  return nodeClass === 'SubgraphInputNode' || nodeClass === 'SubgraphOutputNode'
}

/**
 * Type guard for slot objects (inputs/outputs)
 */
export const isSlotObject = (obj: unknown): obj is INodeSlot => {
  return (
    obj !== null &&
    typeof obj === 'object' &&
    'name' in obj &&
    'type' in obj &&
    'boundingRect' in obj
  )
}
