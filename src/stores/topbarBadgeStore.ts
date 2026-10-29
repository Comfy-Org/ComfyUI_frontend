import { defineStore } from 'pinia'
import { computed } from 'vue'

import { useExtensionStore } from '@/platform/extensions/stores/extensionStore'
import type { TopbarBadge } from '@/types/comfy'

export const useTopbarBadgeStore = defineStore('topbarBadge', () => {
  const extensionStore = useExtensionStore()

  const badges = computed<TopbarBadge[]>(() =>
    extensionStore.extensions.flatMap((e) => e.topbarBadges ?? [])
  )

  return {
    badges
  }
})
