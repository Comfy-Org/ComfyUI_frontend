import { type INodeSlot, LGraph, LGraphNode } from '@comfyorg/litegraph'
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

/**
 * Type guard for safe number conversion
 */
export const isValidNumber = (value: unknown): value is number => {
  return typeof value === 'number' && !isNaN(value) && isFinite(value)
}

/**
 * Type guard for safe string conversion
 */
export const isValidString = (value: unknown): value is string => {
  return typeof value === 'string'
}

/**
 * Type guard for arrays with safe bounds checking
 */
export const isNonEmptyArray = <T>(value: unknown): value is T[] => {
  return Array.isArray(value) && value.length > 0
}
