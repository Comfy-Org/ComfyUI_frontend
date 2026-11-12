import type {
  NodeExecutionOutput,
  ResultItem
} from '@comfyorg/api-client/executionTypes'
import { resultItemType } from '@comfyorg/api-client/resultItemTypeSchema'
import type { AugmentedResultItem } from '@/utils/resultItem'

const METADATA_KEYS = new Set(['animated'])

function isUnknownArray(value: unknown): value is unknown[] {
  return Array.isArray(value)
}

function isResultItem(item: unknown, mediaType: string): item is ResultItem {
  if (!item || typeof item !== 'object' || Array.isArray(item)) return false

  if (
    !('filename' in item && typeof item.filename === 'string') &&
    !(
      mediaType === 'text' &&
      'content' in item &&
      typeof item.content === 'string'
    )
  ) {
    return false
  }

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
      .map((item) =>
        mediaType === 'text' && typeof item === 'string'
          ? { content: item }
          : item
      )
      .filter((item) => isResultItem(item, mediaType))
      .map((item) => ({
        subfolder: '',
        ...item,
        filename: typeof item.filename === 'string' ? item.filename : '',
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
