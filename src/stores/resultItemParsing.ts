import type { NodeExecutionOutput, ResultItem } from '@/schemas/apiSchema'
import { resultItemType } from '@/schemas/apiSchema'
import type { AugmentedResultItem } from '@/utils/resultItem'

const METADATA_KEYS = new Set(['animated', 'text'])

function isUnknownArray(value: unknown): value is unknown[] {
  return Array.isArray(value)
}

/**
 * Validates that an unknown value is a well-formed ResultItem.
 *
 * Requires `filename` (string) since it is needed for a valid URL.
 * `subfolder` is optional here — URL building falls back to ''.
 */
function isResultItem(
  item: unknown
): item is ResultItem & { filename: string } {
  if (!item || typeof item !== 'object' || Array.isArray(item)) return false

  if (!('filename' in item) || typeof item.filename !== 'string') return false

  if (
    'type' in item &&
    item.type !== undefined &&
    !resultItemType.safeParse(item.type).success
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

  return Object.entries(nodeOutput).flatMap(([mediaType, items]) => {
    if (METADATA_KEYS.has(mediaType) || !isUnknownArray(items)) return []
    return items
      .filter(isResultItem)
      .map((item) => ({ ...item, mediaType, nodeId }))
  })
}

export function parseTaskOutput(
  taskOutput: Record<string, NodeExecutionOutput | null | undefined>
): AugmentedResultItem[] {
  return Object.entries(taskOutput).flatMap(([nodeId, nodeOutput]) =>
    parseNodeOutput(nodeId, nodeOutput)
  )
}
