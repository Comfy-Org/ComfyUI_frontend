import { useEventListener } from '@vueuse/core'
import { computed, onUnmounted, ref, watch } from 'vue'

import { api } from '@/scripts/api'
import { useExecutionStore } from '@/stores/executionStore'
import { useQueueStore } from '@/stores/queueStore'
import { jobStateFromTask } from '@/utils/queueUtil'

const BANNER_DISMISS_DELAY_MS = 4000
const MAX_COMPLETION_THUMBNAILS = 3

type QueueQueuedPendingNotification = {
  type: 'queuedPending'
  count: number
  requestId?: number
}

type QueueQueuedNotification = {
  type: 'queued'
  count: number
  requestId?: number
}

type QueueCompletedNotification = {
  type: 'completed'
  count: number
  thumbnailUrl?: string
  thumbnailUrls?: string[]
}

type QueueFailedNotification = {
  type: 'failed'
  count: number
}

export type QueueNotificationBanner =
  | QueueQueuedPendingNotification
  | QueueQueuedNotification
  | QueueCompletedNotification
  | QueueFailedNotification

type PromptQueueingEventPayload = {
  requestId?: number
  batchCount?: number
}
type PromptQueuedEventPayload = {
  requestId?: number
  batchCount?: number
}

const sanitizeCount = (value: number | undefined) => {
  if (value === undefined || Number.isNaN(value) || value <= 0) {
    return 1
  }
  return Math.floor(value)
}

export const useQueueNotificationBanners = () => {
  const queueStore = useQueueStore()
  const executionStore = useExecutionStore()

  const pendingNotifications = ref<QueueNotificationBanner[]>([])
  const activeNotification = ref<QueueNotificationBanner | null>(null)
  const dismissTimer = ref<number | null>(null)
  const lastActiveStartTs = ref<number | null>(null)
  const isQueueActive = computed(
    () => queueStore.runningTasks.length > 0 || !executionStore.isIdle
  )

  const clearDismissTimer = () => {
    if (dismissTimer.value === null) {
      return
    }
    clearTimeout(dismissTimer.value)
    dismissTimer.value = null
  }

  const dismissActiveNotification = () => {
    activeNotification.value = null
    dismissTimer.value = null
    showNextNotification()
  }

  const showNextNotification = () => {
    if (activeNotification.value !== null) {
      return
    }
    const [nextNotification, ...rest] = pendingNotifications.value
    pendingNotifications.value = rest
    if (!nextNotification) {
      return
    }

    activeNotification.value = nextNotification
    clearDismissTimer()
    dismissTimer.value = window.setTimeout(
      dismissActiveNotification,
      BANNER_DISMISS_DELAY_MS
    )
  }

  const queueNotification = (notification: QueueNotificationBanner) => {
    pendingNotifications.value = [...pendingNotifications.value, notification]
    showNextNotification()
  }

  const toQueuedNotification = (
    count: number,
    requestId?: number
  ): QueueQueuedNotification => {
    if (requestId === undefined) {
      return {
        type: 'queued',
        count
      }
    }
    return {
      type: 'queued',
      count,
      requestId
    }
  }

  const toQueuedPendingNotification = (
    count: number,
    requestId?: number
  ): QueueQueuedPendingNotification => {
    if (requestId === undefined) {
      return {
        type: 'queuedPending',
        count
      }
    }
    return {
      type: 'queuedPending',
      count,
      requestId
    }
  }

  const toCompletedNotification = (
    count: number,
    thumbnailUrls: string[]
  ): QueueCompletedNotification => ({
    type: 'completed',
    count,
    thumbnailUrls: thumbnailUrls.slice(0, MAX_COMPLETION_THUMBNAILS)
  })

  const toFailedNotification = (count: number): QueueFailedNotification => ({
    type: 'failed',
    count
  })

  const convertQueuedPendingToQueued = (
    requestId: number | undefined,
    count: number
  ) => {
    if (
      activeNotification.value?.type === 'queuedPending' &&
      (requestId === undefined ||
        activeNotification.value.requestId === requestId)
    ) {
      activeNotification.value = toQueuedNotification(count, requestId)
      return true
    }

    const pendingIndex = pendingNotifications.value.findIndex(
      (notification) =>
        notification.type === 'queuedPending' &&
        (requestId === undefined || notification.requestId === requestId)
    )

    if (pendingIndex === -1) {
      return false
    }

    const queuedPendingNotification = pendingNotifications.value[pendingIndex]
    if (
      queuedPendingNotification === undefined ||
      queuedPendingNotification.type !== 'queuedPending'
    ) {
      return false
    }

    pendingNotifications.value = [
      ...pendingNotifications.value.slice(0, pendingIndex),
      toQueuedNotification(count, queuedPendingNotification.requestId),
      ...pendingNotifications.value.slice(pendingIndex + 1)
    ]

    return true
  }

  const handlePromptQueueing = (event: Event) => {
    const payload = (event as CustomEvent<PromptQueueingEventPayload>).detail
    const count = sanitizeCount(payload?.batchCount)
    queueNotification(toQueuedPendingNotification(count, payload?.requestId))
  }

  const handlePromptQueued = (event: Event) => {
    const payload = (event as CustomEvent<PromptQueuedEventPayload>).detail
    const count = sanitizeCount(payload?.batchCount)
    const handled = convertQueuedPendingToQueued(payload?.requestId, count)
    if (!handled) {
      queueNotification(toQueuedNotification(count, payload?.requestId))
    }
  }

  useEventListener(api, 'promptQueueing', handlePromptQueueing)
  useEventListener(api, 'promptQueued', handlePromptQueued)

  const queueCompletionBatchNotifications = () => {
    const startTs = lastActiveStartTs.value ?? 0
    const finishedTasks = queueStore.historyTasks.filter((task) => {
      const ts = task.executionEndTimestamp
      return typeof ts === 'number' && ts >= startTs
    })

    if (!finishedTasks.length) {
      return
    }

    let completedCount = 0
    let failedCount = 0
    const imagePreviews: string[] = []

    for (const task of finishedTasks) {
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

    if (completedCount > 0) {
      queueNotification(toCompletedNotification(completedCount, imagePreviews))
    }

    if (failedCount > 0) {
      queueNotification(toFailedNotification(failedCount))
    }
  }

  watch(
    isQueueActive,
    (active, prev) => {
      if (!prev && active) {
        lastActiveStartTs.value = Date.now()
        return
      }
      if (prev && !active) {
        queueCompletionBatchNotifications()
      }
    },
    { immediate: true }
  )

  onUnmounted(() => {
    clearDismissTimer()
    pendingNotifications.value = []
    activeNotification.value = null
    lastActiveStartTs.value = null
  })

  const currentNotification = computed(() => activeNotification.value)

  return {
    currentNotification
  }
}
