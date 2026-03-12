import type {
  NodeExecutionOutput,
  ResultItem,
  TaskOutput
} from '@/schemas/apiSchema'
import { resultItemType } from '@/schemas/apiSchema'
import { ResultItemImpl } from '@/stores/queueStore'

const EXCLUDED_KEYS = new Set(['animated'])

/**
 * Strict domain guard for result items.
 *
 * The wire-format schema (zOutputs) is intentionally permissive via
 * `.passthrough()` to accept arbitrary keys from custom nodes. This guard
 * is strict: it requires the fields needed to construct a valid UI model
 * (ResultItemImpl) that can build preview URLs.
 */
export function isResultItemLike(item: unknown): item is ResultItem {
  if (!item || typeof item !== 'object' || Array.isArray(item)) {
    return false
  }

  const candidate = item as Record<string, unknown>

  if (typeof candidate.filename !== 'string') {
    return false
  }

  if (typeof candidate.subfolder !== 'string') {
    return false
  }

  if (
    candidate.type !== undefined &&
    !resultItemType.safeParse(candidate.type).success
  ) {
    return false
  }

  return true
}

/**
 * Flattens a single node's execution output into ResultItemImpl instances.
 *
 * Iterates all output keys dynamically (to support custom node keys like
 * `a_images`, `b_images`, `gifs`, etc.) and validates each item with the
 * strict domain guard before constructing ResultItemImpl.
 */
export function flattenNodeExecutionOutput(
  nodeId: string | number,
  nodeOutput: NodeExecutionOutput
): ResultItemImpl[] {
  return Object.entries(nodeOutput)
    .filter(([key, value]) => !EXCLUDED_KEYS.has(key) && Array.isArray(value))
    .flatMap(([mediaType, items]) =>
      (items as unknown[])
        .filter(isResultItemLike)
        .map((item) => new ResultItemImpl({ ...item, mediaType, nodeId }))
    )
}

/**
 * Flattens all nodes' outputs from a TaskOutput into ResultItemImpl instances.
 */
export function flattenTaskOutputs(
  outputs?: TaskOutput
): ReadonlyArray<ResultItemImpl> {
  if (!outputs) return []
  return Object.entries(outputs).flatMap(([nodeId, nodeOutput]) =>
    flattenNodeExecutionOutput(nodeId, nodeOutput)
  )
}
