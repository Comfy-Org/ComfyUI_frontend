import { defineStore } from 'pinia'
import { computed } from 'vue'

import type { TopbarBadge } from '@/types/comfy'

import { useCustomNodeStore } from '@/platform/customNodes/stores/customNodeStore'

export const useTopbarBadgeStore = defineStore('topbarBadge', () => {
  const customNodeStore = useCustomNodeStore()

  const badges = computed<TopbarBadge[]>(() =>
    customNodeStore.extensions.flatMap((e) => e.topbarBadges ?? [])
  )

  return {
    badges
  }
})
