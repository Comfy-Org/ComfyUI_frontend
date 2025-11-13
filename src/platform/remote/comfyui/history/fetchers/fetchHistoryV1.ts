/**
 * @fileoverview V1 History Fetcher - Desktop/localhost API
 * @module platform/remote/comfyui/history/fetchers/fetchHistoryV1
 *
 * Fetches history directly from V1 API endpoint.
 * Used by desktop and localhost distributions.
 */

import type {
  HistoryTaskItem,
  HistoryV1Response
} from '../types/historyV1Types'

/**
 * Fetches history from V1 API endpoint
 * @param api - API instance with fetchApi method
 * @param maxItems - Maximum number of history items to fetch
 * @param offset - Offset for pagination (must be non-negative integer)
 * @returns Promise resolving to V1 history response
 * @throws Error if offset is invalid (negative or non-integer)
 */
export async function fetchHistoryV1(
  fetchApi: (url: string) => Promise<Response>,
  maxItems: number = 200,
  offset?: number
): Promise<HistoryV1Response> {
  // Validate offset parameter
  if (offset !== undefined && (offset < 0 || !Number.isInteger(offset))) {
    throw new Error(
      `Invalid offset parameter: ${offset}. Must be a non-negative integer.`
    )
  }

  const params = new URLSearchParams({ max_items: maxItems.toString() })
  if (offset !== undefined) {
    params.set('offset', offset.toString())
  }
  const url = `/history?${params.toString()}`
  const res = await fetchApi(url)
  const json: Record<
    string,
    Omit<HistoryTaskItem, 'taskType'>
  > = await res.json()

  return {
    History: Object.values(json).map((item) => ({
      ...item,
      taskType: 'History'
    }))
  }
}
