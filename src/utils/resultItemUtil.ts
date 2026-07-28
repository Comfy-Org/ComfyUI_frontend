import type { ResultItem } from '@/schemas/apiSchema'

/** A result item that can actually be resolved to a `/view` URL. */
export type ViewableResultItem = ResultItem & { filename: string }

/**
 * Output arrays can contain `null` (the output file failed to upload) or a
 * filename-less marker such as `{ status: 'unavailable', reason }`. Neither can
 * be turned into a `/view` request, so they must be skipped rather than
 * rendered. Accepts `unknown` because the live `executed` websocket payload is
 * not schema-validated.
 */
export function isViewableResultItem(
  item: unknown
): item is ViewableResultItem {
  if (typeof item !== 'object' || item === null) return false
  const { filename } = item as ResultItem
  return typeof filename === 'string' && filename !== ''
}
