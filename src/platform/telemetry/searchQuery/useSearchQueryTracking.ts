import { debounce } from 'es-toolkit/compat'
import { onScopeDispose, watch } from 'vue'
import type { Ref } from 'vue'

import { useTelemetry } from '@/platform/telemetry'
import type { SearchSurface } from '@/platform/telemetry/types'

const DEBOUNCE_MS = 500
const MAX_QUERY_CHARS = 100

/**
 * Fires `app:search_query` for the given surface, debounced 500ms.
 * Empty queries are skipped. `results` is read at fire time and only its
 * `.length` is observed, so callers can pass any reactive array (filtered
 * suggestions, displayed results, etc.). The pending debounced call is
 * cancelled on scope dispose so a user who types-and-closes within the
 * window doesn't emit a stale event.
 *
 * The captured `query` is truncated to MAX_QUERY_CHARS to cap PII
 * exposure (mirrors GTM provider's sanitizeProperties cap). `query_length`
 * remains the full pre-truncation length so we keep the distributional
 * signal.
 */
export function useSearchQueryTracking(
  surface: SearchSurface,
  query: Ref<string>,
  results: Ref<{ length: number }>
): void {
  const fire = debounce((value: string) => {
    const trimmed = value.trim()
    if (!trimmed) return
    const count = results.value.length
    useTelemetry()?.trackSearchQuery({
      surface,
      query: trimmed.slice(0, MAX_QUERY_CHARS),
      query_length: trimmed.length,
      result_count: count,
      has_results: count > 0
    })
  }, DEBOUNCE_MS)

  watch(query, fire)
  onScopeDispose(() => fire.cancel())
}
