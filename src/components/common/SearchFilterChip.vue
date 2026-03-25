<template>
  <Chip removable @remove="emit('remove', $event)">
    <Badge :label="badge" :class="semanticBadgeClass" />
    {{ text }}
  </Chip>
</template>

<script setup lang="ts">
import Chip from 'primevue/chip'
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
