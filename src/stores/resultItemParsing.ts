import type { NodeExecutionOutput, ResultItem } from '@/schemas/apiSchema'
import { resultItemType } from '@/schemas/apiSchema'
import { ResultItemImpl } from '@/stores/queueStore'

const METADATA_KEYS = new Set(['animated'])

function isResultItem(item: unknown, mediaType: string): item is ResultItem {
  if (!item || typeof item !== 'object' || Array.isArray(item)) return false

  const candidate = item as Record<string, unknown>

  if (
    typeof candidate.filename !== 'string' &&
    !(mediaType === 'text' && typeof candidate.content === 'string')
  ) {
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

export function parseNodeOutput(
  nodeId: string | number,
  nodeOutput: NodeExecutionOutput | null | undefined
): ResultItemImpl[] {
  if (!nodeOutput) return []

  return Object.entries(nodeOutput)
    .filter(([key, value]) => !METADATA_KEYS.has(key) && Array.isArray(value))
    .flatMap(([mediaType, items]) =>
      (items as unknown[])
        .map((item) =>
          mediaType === 'text' && typeof item === 'string'
            ? { nodeId, mediaType, content: item }
            : item
        )
        .filter((item) => isResultItem(item, mediaType))
        .map((item) => new ResultItemImpl({ ...item, mediaType, nodeId }))
    )
}

export function parseTaskOutput(
  taskOutput: Record<string, NodeExecutionOutput | null | undefined>
): ResultItemImpl[] {
  return Object.entries(taskOutput).flatMap(([nodeId, nodeOutput]) =>
    parseNodeOutput(nodeId, nodeOutput)
  )
}
