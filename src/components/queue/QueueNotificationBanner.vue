<template>
  <div class="inline-flex overflow-hidden rounded-lg bg-secondary-background">
    <div class="flex items-center gap-2 py-1 pr-2 pl-1">
      <div
        :class="
          cn(
            'relative flex size-8 shrink-0 items-center justify-center rounded-[4px]',
            showsCompletionPreview ? 'overflow-hidden p-0' : 'p-1'
          )
        "
      >
        <img
          v-if="showThumbnail"
          :src="notification.thumbnailUrl"
          :alt="t('sideToolbar.queueProgressOverlay.preview')"
          class="h-full w-full object-cover"
        />
        <div
          v-else-if="showCompletionGradientFallback"
          class="size-full bg-linear-to-br from-coral-500 via-coral-500 to-azure-600"
        />
        <i
          v-else
          :class="cn(iconClass, 'size-4', iconColorClass)"
          aria-hidden="true"
        />
      </div>
      <div class="flex h-full items-center pr-1">
        <span
          class="overflow-hidden text-ellipsis text-center font-inter text-[12px] leading-normal font-normal text-base-foreground"
        >
          {{ bannerText }}
        </span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

import type { QueueNotificationBanner as QueueNotificationBannerItem } from '@/composables/queue/useQueueNotificationBanners'
import { cn } from '@/utils/tailwindUtil'

const { notification } = defineProps<{
  notification: QueueNotificationBannerItem
}>()

const { t, n } = useI18n()

const showThumbnail = computed(
  () =>
    notification.type === 'completed' &&
    typeof notification.thumbnailUrl === 'string' &&
    notification.thumbnailUrl.length > 0
)

const showCompletionGradientFallback = computed(
  () => notification.type === 'completed' && !showThumbnail.value
)

const showsCompletionPreview = computed(
  () => showThumbnail.value || showCompletionGradientFallback.value
)

const bannerText = computed(() => {
  const count = notification.count
  if (notification.type === 'queued') {
    if (count === 1) {
      return t('queue.jobAddedToQueue')
    }
    return t(
      'sideToolbar.queueProgressOverlay.jobsAddedToQueue',
      { count: n(count) },
      count
    )
  }
  if (notification.type === 'failed') {
    if (count === 1) {
      return t('sideToolbar.queueProgressOverlay.jobFailed')
    }
    return t(
      'sideToolbar.queueProgressOverlay.jobsFailed',
      { count: n(count) },
      count
    )
  }
  if (count === 1) {
    return t('sideToolbar.queueProgressOverlay.jobCompleted')
  }
  return t(
    'sideToolbar.queueProgressOverlay.jobsCompleted',
    { count: n(count) },
    count
  )
})

const iconClass = computed(() => {
  if (notification.type === 'queued') {
    return 'icon-[lucide--check]'
  }
  if (notification.type === 'failed') {
    return 'icon-[lucide--circle-alert]'
  }
  return 'icon-[lucide--image]'
})

const iconColorClass = computed(() => {
  if (notification.type === 'failed') {
    return 'text-danger-200'
  }
  return 'text-slate-100'
})
</script>
