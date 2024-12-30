<template>
  <Chip removable @remove="$emit('remove', $event)">
    <Badge size="small" :class="badgeClass">
      {{ badge }}
    </Badge>
    {{ text }}
  </Chip>
</template>

<script setup lang="ts">
import Badge from 'primevue/badge'
import Chip from 'primevue/chip'

export interface SearchFilter {
  text: string
  badge: string
  badgeClass: string
  id: string | number
}

defineProps<Omit<SearchFilter, 'id'>>()
defineEmits(['remove'])
</script>

<style scoped>
:deep(.i-badge) {
  @apply bg-green-500 text-white;
}

:deep(.o-badge) {
  @apply bg-red-500 text-white;
}

:deep(.c-badge) {
  @apply bg-blue-500 text-white;
}

:deep(.s-badge) {
  @apply bg-yellow-500;
}
</style>
