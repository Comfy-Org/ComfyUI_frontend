import type { NodeExecutionOutput, ResultItem } from '@/schemas/apiSchema'
import { resultItemType } from '@/schemas/apiSchema'
import { ResultItemImpl } from '@/stores/queueStore'

const METADATA_KEYS = new Set(['animated', 'text'])

/**
 * Validates that an unknown value is a well-formed ResultItem.
 *
 * Requires `filename` (string) since ResultItemImpl needs it for a valid URL.
 * `subfolder` is optional here — ResultItemImpl constructor falls back to ''.
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
  nodeOutput: NodeExecutionOutput
): ResultItemImpl[] {
  return Object.entries(nodeOutput)
    .filter(([key, value]) => !METADATA_KEYS.has(key) && Array.isArray(value))
    .flatMap(([mediaType, items]) =>
      (items as unknown[])
        .filter(isResultItem)
        .map((item) => new ResultItemImpl({ ...item, mediaType, nodeId }))
    )
}

export function parseTaskOutput(
  taskOutput: Record<string, NodeExecutionOutput>
): ResultItemImpl[] {
  return Object.entries(taskOutput).flatMap(([nodeId, nodeOutput]) =>
    parseNodeOutput(nodeId, nodeOutput)
  )
}
