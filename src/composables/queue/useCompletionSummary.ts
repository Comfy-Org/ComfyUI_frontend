import { computed, ref, watch } from 'vue'

import { useExecutionStore } from '@/stores/executionStore'
import { useQueueStore } from '@/stores/queueStore'
import { jobStateFromTask } from '@/utils/queueUtil'

export type CompletionSummaryMode = 'allSuccess' | 'mixed' | 'allFailed'

export type CompletionSummary = {
  mode: CompletionSummaryMode
  completedCount: number
  failedCount: number
  thumbnailUrls: string[]
}

/**
 * Tracks queue activity transitions and exposes a short-lived summary of the
 * most recent generation batch.
 */
export const useCompletionSummary = () => {
  const queueStore = useQueueStore()
  const executionStore = useExecutionStore()

  const isActive = computed(
    () => queueStore.runningTasks.length > 0 || !executionStore.isIdle
  )

  const lastActiveStartTs = ref<number | null>(null)
  const _summary = ref<CompletionSummary | null>(null)
  const dismissTimer = ref<number | null>(null)

  const clearDismissTimer = () => {
    if (dismissTimer.value !== null) {
      clearTimeout(dismissTimer.value)
      dismissTimer.value = null
    }
  }

  const startDismissTimer = () => {
    clearDismissTimer()
    dismissTimer.value = window.setTimeout(() => {
      _summary.value = null
      dismissTimer.value = null
    }, 6000)
  }

  const clearSummary = () => {
    _summary.value = null
    clearDismissTimer()
  }

  watch(
    isActive,
    (active, prev) => {
      if (!prev && active) {
        lastActiveStartTs.value = Date.now()
      }
      if (prev && !active) {
        const start = lastActiveStartTs.value ?? 0
        const finished = queueStore.historyTasks.filter((t: any) => {
          const ts: number | undefined = t.executionEndTimestamp
          return typeof ts === 'number' && ts >= start
        })

        if (!finished.length) {
          _summary.value = null
          clearDismissTimer()
          return
        }

        let completedCount = 0
        let failedCount = 0
        const imagePreviews: string[] = []

        for (const task of finished) {
          const state = jobStateFromTask(task, false)
          if (state === 'completed') {
            completedCount++
            const preview = task.previewOutput
            if (preview?.isImage) {
              imagePreviews.push(preview.urlWithTimestamp)
            }
          } else if (state === 'failed') {
            failedCount++
          }
        }

        if (completedCount === 0 && failedCount === 0) {
          _summary.value = null
          clearDismissTimer()
          return
        }

        let mode: CompletionSummaryMode = 'mixed'
        if (failedCount === 0) mode = 'allSuccess'
        else if (completedCount === 0) mode = 'allFailed'

        _summary.value = {
          mode,
          completedCount,
          failedCount,
          thumbnailUrls: imagePreviews.slice(0, 3)
        }
        startDismissTimer()
      }
    },
    { immediate: true }
  )

  const summary = computed(() => _summary.value)

  return {
    summary,
    clearSummary
  }
}
