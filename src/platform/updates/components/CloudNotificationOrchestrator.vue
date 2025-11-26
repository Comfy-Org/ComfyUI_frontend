<template>
  <span class="sr-only" aria-hidden="true" />
</template>

<script setup lang="ts">
import { onBeforeUnmount, onMounted, watch } from 'vue'
import type { WatchStopHandle } from 'vue'

import { useCloudNotificationStore } from '@/platform/updates/common/cloudNotificationStore'
import { useDialogService } from '@/services/dialogService'

const dialogService = useDialogService()
const cloudNotificationStore = useCloudNotificationStore()

let stopWatcher: WatchStopHandle | null = null

onMounted(async () => {
  await cloudNotificationStore.initialize()

  stopWatcher = watch(
    () => cloudNotificationStore.shouldShowNotification,
    (shouldShow) => {
      if (shouldShow) {
        cloudNotificationStore.markSessionShown()
        dialogService.showCloudNotification()

        void cloudNotificationStore
          .persistNotificationShown()
          .catch((error) => {
            console.error('[CloudNotification] Failed to persist flag', error)
          })
      }
    },
    { immediate: true }
  )
})

onBeforeUnmount(() => {
  stopWatcher?.()
  stopWatcher = null
})
</script>
