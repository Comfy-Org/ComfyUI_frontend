import type { NodeExecutionOutput, ResultItem } from '@/schemas/apiSchema'
import { resultItemType } from '@/schemas/apiSchema'
import type { AugmentedResultItem } from '@/utils/resultItem'

const METADATA_KEYS = new Set(['animated', 'text'])

/**
 * Validates that an unknown value is a well-formed ResultItem.
 *
 * Requires `filename` (string) since it is needed for a valid URL.
 * `subfolder` is optional here — URL building falls back to ''.
 */
function isResultItem(item: unknown): item is ResultItem {
  if (!item || typeof item !== 'object' || Array.isArray(item)) return false

  const candidate = item as Record<string, unknown>

  if (typeof candidate.filename !== 'string') return false

  if (
    candidate.type !== undefined &&
    !resultItemType.safeParse(candidate.type).success
  ) {
    return false
  }

  return true
}

export function parseNodeOutput(
  nodeId: string | number,
  nodeOutput: NodeExecutionOutput | null | undefined
): AugmentedResultItem[] {
  if (!nodeOutput) return []

  return Object.entries(nodeOutput)
    .filter(([key, value]) => !METADATA_KEYS.has(key) && Array.isArray(value))
    .flatMap(([mediaType, items]) =>
      (items as unknown[])
        .filter(isResultItem)
        .map((item) => ({ ...item, mediaType, nodeId }))
    )
}

export function parseTaskOutput(
  taskOutput: Record<string, NodeExecutionOutput | null | undefined>
): AugmentedResultItem[] {
  return Object.entries(taskOutput).flatMap(([nodeId, nodeOutput]) =>
    parseNodeOutput(nodeId, nodeOutput)
  )
}
