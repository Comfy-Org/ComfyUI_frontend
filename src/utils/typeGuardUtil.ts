import type { LGraph, Subgraph } from '@comfyorg/graph-model/entityRegistry'
import type { INodeSlot } from '@comfyorg/graph-model/interfaces'
import type { ResultItemType } from '@comfyorg/graph-model/resultItemTypeSchema'

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
 * Type guard to check if a string is a valid ResultItemType
 * ResultItemType is used for asset categorization (input/output/temp)
 */
export const isResultItemType = (
  value: string | undefined
): value is ResultItemType => {
  return value === 'input' || value === 'output' || value === 'temp'
}
