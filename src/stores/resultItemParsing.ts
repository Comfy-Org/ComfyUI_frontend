import type { NodeExecutionOutput, ResultItem } from '@/schemas/apiSchema'
import { resultItemType } from '@/schemas/apiSchema'
import { ResultItemImpl } from '@/stores/queueStore'

const METADATA_KEYS = new Set(['animated'])

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

/**
 * Reads the text payload from a single `text` entry. Detail/subfeed responses
 * deliver raw strings, while the jobs list synthesizes the array from a
 * `preview_output` object (`{ content }`); both must resolve to a string.
 */
function getTextContent(item: unknown): string | undefined {
  if (typeof item === 'string') return item
  if (item && typeof item === 'object' && 'content' in item) {
    const { content } = item as { content?: unknown }
    if (typeof content === 'string') return content
  }
  return undefined
}

/**
 * Builds previewable text outputs from a node's `text` array.
 *
 * Text outputs have no backing file, so we synthesize a `.txt` filename. This
 * lets text ride the same filename-based machinery as media outputs (media-type
 * detection, dedupe keys, asset mapping) and render via the existing text
 * preview components.
 */
function parseTextOutput(
  nodeId: string | number,
  items: unknown[]
): ResultItemImpl[] {
  return items
    .map(getTextContent)
    .filter((content): content is string => content !== undefined)
    .map(
      (content, index) =>
        new ResultItemImpl({
          filename: `${nodeId}-text-${index}.txt`,
          nodeId,
          mediaType: 'text',
          content
        })
    )
}

export function parseNodeOutput(
  nodeId: string | number,
  nodeOutput: NodeExecutionOutput | null | undefined
): ResultItemImpl[] {
  if (!nodeOutput) return []

  return Object.entries(nodeOutput)
    .filter(([key, value]) => !METADATA_KEYS.has(key) && Array.isArray(value))
    .flatMap(([mediaType, items]) =>
      mediaType === 'text'
        ? parseTextOutput(nodeId, items as unknown[])
        : (items as unknown[])
            .filter(isResultItem)
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
