import { useIntervalFn } from '@vueuse/core'
import { watch } from 'vue'

import { useQueueStore } from '@/stores/queueStore'

const POLL_INTERVAL_MS = 5_000

export function useQueuePolling() {
  const queueStore = useQueueStore()

  void queueStore.update()

  const { pause, resume } = useIntervalFn(
    () => void queueStore.update(),
    POLL_INTERVAL_MS,
    { immediate: false }
  )

  watch(
    () => queueStore.activeJobsCount > 0,
    (hasActiveJobs) => {
      if (hasActiveJobs) resume()
      else pause()
    },
    { immediate: true }
  )
}
