import { useEventListener } from '@vueuse/core'
import { computed, onUnmounted, ref, watch } from 'vue'

import { useCompletionSummary } from '@/composables/queue/useCompletionSummary'
import { api } from '@/scripts/api'

const BANNER_DISMISS_DELAY_MS = 4000

type QueueNotificationBannerType = 'queued' | 'completed' | 'failed'

export type QueueNotificationBanner = {
  type: QueueNotificationBannerType
  count: number
  thumbnailUrl?: string
}

type PromptQueuedEventPayload = {
  batchCount?: number
}

const sanitizeCount = (value: number | undefined) => {
  if (value === undefined || Number.isNaN(value) || value <= 0) {
    return 1
  }
  return Math.floor(value)
}

export const useQueueNotificationBanners = () => {
  const { summary, clearSummary } = useCompletionSummary()

  const pendingNotifications = ref<QueueNotificationBanner[]>([])
  const activeNotification = ref<QueueNotificationBanner | null>(null)
  const dismissTimer = ref<number | null>(null)

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

  const handlePromptQueued = (event: Event) => {
    const payload = (event as CustomEvent<PromptQueuedEventPayload>).detail
    queueNotification({
      type: 'queued',
      count: sanitizeCount(payload?.batchCount)
    })
  }

  useEventListener(api, 'promptQueued', handlePromptQueued)

  watch(summary, (completionSummary) => {
    if (!completionSummary) {
      return
    }

    if (completionSummary.completedCount > 0) {
      queueNotification({
        type: 'completed',
        count: completionSummary.completedCount,
        thumbnailUrl: completionSummary.thumbnailUrls[0]
      })
    }

    if (completionSummary.failedCount > 0) {
      queueNotification({
        type: 'failed',
        count: completionSummary.failedCount
      })
    }

    clearSummary()
  })

  onUnmounted(() => {
    clearDismissTimer()
    pendingNotifications.value = []
    activeNotification.value = null
  })

  const currentNotification = computed(() => activeNotification.value)

  return {
    currentNotification
  }
}
