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
 * @returns Promise resolving to V1 history response
 */
export async function fetchHistoryV1(
  fetchApi: (url: string) => Promise<Response>,
  maxItems: number = 200
): Promise<HistoryV1Response> {
  const res = await fetchApi(`/history?max_items=${maxItems}`)
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
