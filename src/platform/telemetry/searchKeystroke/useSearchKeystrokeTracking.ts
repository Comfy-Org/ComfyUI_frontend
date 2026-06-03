import { debounce } from 'es-toolkit/compat'
import { watch } from 'vue'
import type { Ref } from 'vue'

import { useSubscription } from '@/platform/cloud/subscription/composables/useSubscription'
import { useTelemetry } from '@/platform/telemetry'
import type { SearchSurface } from '@/platform/telemetry/types'

const DEBOUNCE_MS = 500

function isPaidTier(): boolean {
  try {
    const tier = useSubscription().subscriptionTier.value
    return tier != null && tier !== 'FREE'
  } catch {
    return false
  }
}

/**
 * Fires `app:search_keystroke` for the given surface, debounced 500ms,
 * gated to paid subscribers. Empty queries are skipped. The subscription
 * check runs at fire time, so this composable is safe to call from any
 * component regardless of whether the subscription store is initialised.
 */
export function useSearchKeystrokeTracking(
  surface: SearchSurface,
  query: Ref<string>
): void {
  const fire = debounce((value: string) => {
    if (!isPaidTier()) return
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
