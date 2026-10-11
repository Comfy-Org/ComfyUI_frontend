import type { ResultItemType } from '@/schemas/resultItemTypeSchema'
import { resultItemType } from '@/schemas/resultItemTypeSchema'

/**
 * A result item that can be resolved to a `/view` URL. `subfolder` and `type`
 * may be absent; build requests with {@link toViewRequest} to apply the
 * backend's defaults.
 */
export type ViewableResultItem = {
  filename: string
  subfolder?: string | null
  type?: ResultItemType | null
}

/**
 * Output arrays can contain `null` (the output file failed to upload) or a
 * filename-less marker such as `{ status: 'unavailable', reason }`. Neither can
 * be turned into a `/view` request, so they must be skipped rather than
 * rendered. A present but unrecognized `type` is rejected rather than defaulted,
 * since `/view` would otherwise serve an unrelated file of the same name.
 * Accepts `unknown` because the live `executed` websocket payload is not
 * schema-validated.
 */
export function isViewableResultItem<T>(
  item: T
): item is T & ViewableResultItem {
  if (typeof item !== 'object' || item === null || !('filename' in item))
    return false
  const { filename } = item
  if (typeof filename !== 'string' || filename === '') return false

  const subfolder = 'subfolder' in item ? item.subfolder : undefined
  if (subfolder != null && typeof subfolder !== 'string') return false

  const type = 'type' in item ? item.type : undefined
  return type == null || resultItemType.safeParse(type).success
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

export function toViewRequest(item: ViewableResultItem): {
  filename: string
  subfolder: string
  type: ResultItemType
} {
  return {
    filename: item.filename,
    subfolder: item.subfolder ?? '',
    type: item.type ?? 'output'
  }
}
