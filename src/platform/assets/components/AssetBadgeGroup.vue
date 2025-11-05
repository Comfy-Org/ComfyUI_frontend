<template>
  <div class="absolute right-2 bottom-2 flex flex-wrap justify-end gap-1">
    <span
      v-for="badge in badges"
      :key="badge.label"
      :class="
        cn(
          'px-2 py-1 rounded text-xs font-medium uppercase tracking-wider text-white',
          getBadgeColor(badge.type)
        )
      "
    >
      {{ badge.label }}
    </span>
  </div>
</template>

<script setup lang="ts">
import { cn } from '@/utils/tailwindUtil'

type AssetBadge = {
  label: string
  type: 'type' | 'base' | 'size'
}

defineProps<{
  badges: AssetBadge[]
}>()

function getBadgeColor(type: AssetBadge['type']): string {
  switch (type) {
    case 'type':
      return 'bg-azure-600/90 dark-theme:bg-azure-600/80'
    case 'base':
      return 'bg-jade-600/90 dark-theme:bg-jade-600/80'
    case 'size':
      return 'bg-ash-500/90 dark-theme:bg-charcoal-700/80'
    default:
      return 'bg-ash-500/90 dark-theme:bg-charcoal-700/80'
  }
}
</script>
