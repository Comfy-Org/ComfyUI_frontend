import { ref, watch } from 'vue'
import type { WatchSource } from 'vue'

/**
 * Retries media that failed to load when its outputs arrive again. A stable
 * /view URL is not refetched on its own, so callers remount on `retryKey`
 * (or reload) when `trigger` changes while the last load had failed. Unlike
 * useRetryableMediaSrc, it never retries on a timer.
 */
export function useLoadRetry(trigger?: WatchSource) {
  const failed = ref(false)
  const retryKey = ref(0)

  if (trigger)
    watch(trigger, () => {
      if (!failed.value) return
      failed.value = false
      retryKey.value++
    })

  return {
    failed,
    retryKey,
    onError: () => (failed.value = true),
    onLoad: () => (failed.value = false)
  }
}
