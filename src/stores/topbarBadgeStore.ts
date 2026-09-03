import { contributedBadges } from '@/platform/nodeApi/chromeContributions'
import { defineStore } from 'pinia'
import { computed } from 'vue'

import type { TopbarBadge } from '@/types/comfy'

import { useExtensionStore } from './extensionStore'

export const useTopbarBadgeStore = defineStore('topbarBadge', () => {
  const extensionStore = useExtensionStore()

  const badges = computed<TopbarBadge[]>(() => [
    ...extensionStore.extensions.flatMap((e) => e.topbarBadges ?? []),
    ...contributedBadges.value
  ])

  return {
    badges
  }
})
