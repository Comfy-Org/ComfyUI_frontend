import { ref, watch } from 'vue'
import type { WatchSource } from 'vue'

/**
 * Retries media that failed to load when its outputs arrive again. A stable
 * /view URL is not refetched on its own, so callers remount on `retryKey`
 * (or reload) after `refresh()` runs, or after `trigger` changes, while the
 * last load had failed.
 */
export function useLoadRetry(trigger?: WatchSource) {
  const failed = ref(false)
  const retryKey = ref(0)

  function refresh() {
    if (!failed.value) return
    failed.value = false
    retryKey.value++
  }

  if (trigger) watch(trigger, refresh)

  return {
    failed,
    retryKey,
    refresh,
    onError: () => (failed.value = true),
    onLoad: () => (failed.value = false)
  }
}
