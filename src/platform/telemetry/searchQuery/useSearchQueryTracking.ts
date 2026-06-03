import { debounce } from 'es-toolkit/compat'
import { watch } from 'vue'
import type { Ref } from 'vue'

import { useTelemetry } from '@/platform/telemetry'
import type { SearchSurface } from '@/platform/telemetry/types'

const DEBOUNCE_MS = 500

/**
 * Fires `app:search_query` for the given surface, debounced 500ms.
 * Empty queries are skipped. `resultCount` is read at fire time so the
 * caller can pass any reactive source (computed off filtered length,
 * etc.).
 */
export function useSearchQueryTracking(
  surface: SearchSurface,
  query: Ref<string>,
  resultCount: Ref<number>
): void {
  const fire = debounce((value: string) => {
    const trimmed = value.trim()
    if (!trimmed) return
    const count = resultCount.value
    useTelemetry()?.trackSearchQuery({
      surface,
      query: trimmed,
      query_length: trimmed.length,
      result_count: count,
      has_results: count > 0
    })
  }, DEBOUNCE_MS)

  watch(query, fire)
}
