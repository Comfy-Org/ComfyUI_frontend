import { LGraph, LGraphNode } from '@comfyorg/litegraph'
import { Subgraph } from '@comfyorg/litegraph'

import type { PrimitiveNode } from '@/extensions/core/widgetInputs'

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
