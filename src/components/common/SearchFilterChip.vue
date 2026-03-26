<template>
  <span
    class="inline-flex items-center gap-1 rounded-2xl bg-surface-700 py-0.5 pr-1 pl-2 text-xs"
  >
    <Badge :label="badge" :class="semanticBadgeClass" />
    {{ text }}
    <button
      class="inline-flex cursor-pointer items-center justify-center rounded-full p-0.5 hover:bg-surface-600"
      @click="emit('remove', $event)"
    >
      <i class="icon-[lucide--x] size-3 text-muted-foreground" />
    </button>
  </span>
</template>

<script setup lang="ts">
import { computed } from 'vue'

import Badge from '@/components/common/Badge.vue'

export interface SearchFilter {
  text: string
  badge: string
  badgeClass: string
  id: string | number
}

const semanticClassMap: Record<string, string> = {
  'i-badge': 'bg-green-500 text-[color:white]',
  'o-badge': 'bg-red-500 text-[color:white]',
  'c-badge': 'bg-blue-500 text-[color:white]',
  's-badge': 'bg-yellow-500'
}

const props = defineProps<Omit<SearchFilter, 'id'>>()
const emit = defineEmits<{
  (e: 'remove', event: Event): void
}>()

const semanticBadgeClass = computed(() => {
  return semanticClassMap[props.badgeClass] ?? props.badgeClass
})
</script>
