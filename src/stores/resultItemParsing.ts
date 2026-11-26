import type {
  NodeExecutionOutput,
  ResultItem
} from '@comfyorg/api-client/executionTypes'
import { zResultItem } from '@comfyorg/api-client/executionTypes'
import type { AugmentedResultItem } from '@/utils/resultItem'

const METADATA_KEYS = new Set(['animated'])
const resultItemSchema = zResultItem.passthrough()

function isUnknownArray(value: unknown): value is unknown[] {
  return Array.isArray(value)
}

function isResultItem(item: unknown, mediaType: string): item is ResultItem {
  const parsed = resultItemSchema.safeParse(item)
  if (!parsed.success) return false
  if (parsed.data.filename !== undefined) return true
  return mediaType === 'text' && typeof parsed.data.content === 'string'
}

export function parseNodeOutput(
  nodeId: string | number,
  nodeOutput: Record<string, unknown> | null | undefined
): AugmentedResultItem[] {
  if (!nodeOutput) return []

  return Object.entries(nodeOutput).flatMap(([mediaType, items]) => {
    if (METADATA_KEYS.has(mediaType) || !isUnknownArray(items)) return []
    return items
      .map((item) =>
        mediaType === 'text' && typeof item === 'string'
          ? { content: item }
          : item
      )
      .filter((item) => isResultItem(item, mediaType))
      .map((item) => ({
        subfolder: '',
        ...item,
        filename: item.filename ?? '',
        mediaType,
        nodeId
      }))
  })
}

export function parseTaskOutput(
  taskOutput: Record<string, NodeExecutionOutput | null | undefined>
): AugmentedResultItem[] {
  return Object.entries(taskOutput).flatMap(([nodeId, nodeOutput]) =>
    parseNodeOutput(nodeId, nodeOutput)
  )
}
