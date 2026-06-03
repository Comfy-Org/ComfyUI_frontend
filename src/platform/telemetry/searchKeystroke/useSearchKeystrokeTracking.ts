import { debounce } from 'es-toolkit/compat'
import { watch } from 'vue'
import type { Ref } from 'vue'

import { useTelemetry } from '@/platform/telemetry'
import type { SearchSurface } from '@/platform/telemetry/types'

const DEBOUNCE_MS = 500

/**
 * Fires `app:search_keystroke` for the given surface, debounced 500ms.
 * Empty queries are skipped.
 */
export function useSearchKeystrokeTracking(
  surface: SearchSurface,
  query: Ref<string>
): void {
  const fire = debounce((value: string) => {
    const trimmed = value.trim()
    if (!trimmed) return
    useTelemetry()?.trackSearchKeystroke({
      surface,
      query: trimmed,
      query_length: trimmed.length
    })
  }, DEBOUNCE_MS)

  watch(query, fire)
}
