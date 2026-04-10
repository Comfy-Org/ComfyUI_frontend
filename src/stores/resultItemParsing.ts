import type { NodeExecutionOutput, ResultItem } from '@/schemas/apiSchema'
import { resultItemType } from '@/schemas/apiSchema'
import { ResultItemImpl } from '@/stores/queueStore'

const EXCLUDED_KEYS = new Set(['animated', 'text', 'a_images', 'b_images'])

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

function toResultItems(
  items: unknown[],
  mediaType: string,
  nodeId: string | number
): ResultItemImpl[] {
  return items
    .filter(isResultItem)
    .map((item) => new ResultItemImpl({ ...item, mediaType, nodeId }))
}

function parseImageCompare(
  nodeOutput: NodeExecutionOutput,
  nodeId: string | number
): ResultItemImpl | null {
  const aImages = nodeOutput.a_images
  const bImages = nodeOutput.b_images
  if (!Array.isArray(aImages) && !Array.isArray(bImages)) return null

  const before = Array.isArray(aImages)
    ? toResultItems(aImages, 'images', nodeId)
    : []
  const after = Array.isArray(bImages)
    ? toResultItems(bImages, 'images', nodeId)
    : []

  if (before.length === 0 && after.length === 0) return null

  return new ResultItemImpl({
    filename: '',
    subfolder: '',
    type: 'output',
    mediaType: 'image_compare',
    nodeId,
    compareImages: { before, after }
  })
}

export function parseNodeOutput(
  nodeId: string | number,
  nodeOutput: NodeExecutionOutput
): ResultItemImpl[] {
  const regularItems = Object.entries(nodeOutput)
    .filter(([key, value]) => !EXCLUDED_KEYS.has(key) && Array.isArray(value))
    .flatMap(([mediaType, items]) =>
      toResultItems(items as unknown[], mediaType, nodeId)
    )
  const compareItem = parseImageCompare(nodeOutput, nodeId)
  return compareItem ? [compareItem, ...regularItems] : regularItems
}

export function parseTaskOutput(
  taskOutput: Record<string, NodeExecutionOutput>
): ResultItemImpl[] {
  return Object.entries(taskOutput).flatMap(([nodeId, nodeOutput]) =>
    parseNodeOutput(nodeId, nodeOutput)
  )
}
