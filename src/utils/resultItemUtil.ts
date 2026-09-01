import type { ResultItemType } from '@/schemas/resultItemTypeSchema'
import { resultItemType } from '@/schemas/resultItemTypeSchema'

/**
 * A result item that can be resolved to a `/view` URL. Only `filename` is
 * guaranteed at runtime — the live `executed` websocket payload is not
 * schema-validated, so `subfolder` and `type` may still be absent or malformed.
 * Build requests with {@link toViewRequest} instead of reading those directly.
 */
export type ViewableResultItem = {
  filename: string
  subfolder?: unknown
  type?: unknown
}

/**
 * Output arrays can contain `null` (the output file failed to upload) or a
 * filename-less marker such as `{ status: 'unavailable', reason }`. Neither can
 * be turned into a `/view` request, so they must be skipped rather than
 * rendered. Accepts `unknown` because the live `executed` websocket payload is
 * not schema-validated.
 */
export function isViewableResultItem<T>(
  item: T
): item is T & ViewableResultItem {
  if (typeof item !== 'object' || item === null) return false
  const { filename } = item as { filename?: unknown }
  return typeof filename === 'string' && filename !== ''
}

/**
 * The collection itself is equally untrusted: a declared array can arrive as a
 * non-array `images`/`audio` value, so the `Array.isArray` guard stays even
 * though the parameter type says otherwise.
 */
export function viewableResultItems<T>(
  items: readonly T[] | null | undefined
): (T & ViewableResultItem)[] {
  return Array.isArray(items) ? items.filter(isViewableResultItem) : []
}

export function findViewableResultItem<T>(
  items: readonly T[] | null | undefined
): (T & ViewableResultItem) | undefined {
  return Array.isArray(items) ? items.find(isViewableResultItem) : undefined
}

/** Normalizes an entry to the fields a `/view` request needs. */
export function toViewRequest(item: ViewableResultItem): {
  filename: string
  subfolder: string
  type: ResultItemType
} {
  const parsedType = resultItemType.safeParse(item.type)
  return {
    filename: item.filename,
    subfolder: typeof item.subfolder === 'string' ? item.subfolder : '',
    type: parsedType.success ? parsedType.data : 'output'
  }
}
