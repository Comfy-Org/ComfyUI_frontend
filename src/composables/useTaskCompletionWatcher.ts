import { type WatchStopHandle, onUnmounted, readonly, ref, watch } from 'vue'

import { useQueueStore } from '@/stores/queueStore'

export interface TaskCompletionWatcherOptions {
  onComplete?: () => void
  immediate?: boolean
}

export function useTaskCompletionWatcher(
  options: TaskCompletionWatcherOptions = {}
) {
  const { onComplete, immediate = false } = options
  const queueStore = useQueueStore()
  const isWatching = ref(false)
  let stopHandle: WatchStopHandle | null = null
  let previousHistoryCount = queueStore.historyTasks.length

  const start = () => {
    if (isWatching.value) return

    // Reset count to current
    previousHistoryCount = queueStore.historyTasks.length

    stopHandle = watch(
      () => queueStore.historyTasks.length,
      (newCount) => {
        const previousCount = previousHistoryCount
        previousHistoryCount = newCount

        // Only trigger if history increased (task completed)
        // If history decreased (tasks deleted), just update the count
        if (newCount > previousCount) {
          onComplete?.()
        }
      },
      { immediate }
    )

    isWatching.value = true
  }

  const stop = () => {
    if (!isWatching.value) return

    stopHandle?.()
    stopHandle = null
    isWatching.value = false
  }

  const trigger = () => {
    onComplete?.()
  }

  if (immediate) {
    start()
  }

  onUnmounted(() => stop())

  return {
    start,
    stop,
    trigger,
    isWatching: readonly(isWatching)
  }
}
