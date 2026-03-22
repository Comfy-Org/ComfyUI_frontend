<template>
  <div
    v-for="announcement in visibleAnnouncements"
    :key="announcement.id"
    role="status"
    :class="
      cn(
        'flex items-center justify-between gap-3 px-4 py-2 text-sm',
        severityClasses[announcement.severity]
      )
    "
  >
    <div class="flex items-center gap-2">
      <i :class="severityIcons[announcement.severity]" />
      <span>{{ announcement.message }}</span>
    </div>
    <button
      v-if="announcement.dismissible !== false"
      class="shrink-0 cursor-pointer rounded p-0.5 opacity-70 transition-opacity hover:opacity-100"
      @click="dismiss(announcement.id)"
    >
      <i class="pi pi-times text-xs" />
    </button>
  </div>
</template>

<script setup lang="ts">
import { useStorage } from '@vueuse/core'
import { computed } from 'vue'

import { remoteConfig } from '@/platform/remoteConfig/remoteConfig'
import { cn } from '@/utils/tailwindUtil'

const dismissedIds = useStorage<Record<string, number>>(
  'comfy.announcements.dismissed',
  {},
  localStorage
)

const severityClasses: Record<string, string> = {
  info: 'bg-blue-600 text-white',
  warning: 'bg-gold-600 text-black',
  critical: 'bg-danger-100 text-white'
}

const severityIcons: Record<string, string> = {
  info: 'pi pi-info-circle',
  warning: 'icon-[lucide--triangle-alert]',
  critical: 'pi pi-exclamation-circle'
}

const visibleAnnouncements = computed(() => {
  const announcements = remoteConfig.value.announcements ?? []
  return announcements.filter((a) => !dismissedIds.value[a.id])
})

function dismiss(id: string) {
  dismissedIds.value = {
    ...dismissedIds.value,
    [id]: Date.now()
  }
}
</script>
