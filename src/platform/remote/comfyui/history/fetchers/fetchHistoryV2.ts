/**
 * @fileoverview V2 History Fetcher - Cloud API with adapter
 * @module platform/remote/comfyui/history/fetchers/fetchHistoryV2
 *
 * Fetches history from V2 API endpoint and converts to V1 format.
 * Used exclusively by cloud distribution.
 */

import { mapHistoryV2toHistory } from '../adapters/v2ToV1Adapter'
import type { HistoryV1Response } from '../types/historyV1Types'
import type { HistoryResponseV2 } from '../types/historyV2Types'

/**
 * Fetches history from V2 API endpoint and adapts to V1 format
 * @param fetchApi - API instance with fetchApi method
 * @param maxItems - Maximum number of history items to fetch
 * @returns Promise resolving to V1 history response (adapted from V2)
 */
export async function fetchHistoryV2(
  fetchApi: (url: string) => Promise<Response>,
  maxItems: number = 200
): Promise<HistoryV1Response> {
  const res = await fetchApi(`/history_v2?max_items=${maxItems}`)
  const rawData: HistoryResponseV2 = await res.json()
  const adaptedHistory = mapHistoryV2toHistory(rawData)
  return { History: adaptedHistory }
}
