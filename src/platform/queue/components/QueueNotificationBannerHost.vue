<template>
  <div
    v-if="currentNotification"
    class="flex justify-end"
    role="status"
    aria-live="polite"
    aria-atomic="true"
    data-testid="queue-notification-banner"
  >
    <QueueNotificationBanner :notification="currentNotification" />
  </div>
</template>

<script setup lang="ts">
import QueueNotificationBanner from '@/platform/queue/components/QueueNotificationBanner.vue'
import { useQueueNotificationBanners } from '@/platform/queue/composables/useQueueNotificationBanners'

const { currentNotification } = useQueueNotificationBanners()
</script>
