import type { NodeExecutionOutput, ResultItem } from '@/schemas/apiSchema'
import { resultItemType } from '@/schemas/apiSchema'
import { ResultItemImpl } from '@/stores/queueStore'

const EXCLUDED_KEYS = new Set(['animated'])

function isResultItemLike(item: unknown): item is ResultItem {
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

export function flattenNodeOutput([nodeId, nodeOutput]: [
  string | number,
  NodeExecutionOutput
]): ResultItemImpl[] {
  return Object.entries(nodeOutput)
    .filter(([key, value]) => !EXCLUDED_KEYS.has(key) && Array.isArray(value))
    .flatMap(([mediaType, items]) =>
      (items as unknown[])
        .filter(isResultItemLike)
        .map((item) => new ResultItemImpl({ ...item, mediaType, nodeId }))
    )
}
