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
  background-color: var(--color-green-500);
  color: var(--color-white);
}

:deep(.o-badge) {
  background-color: var(--color-red-500);
  color: var(--color-white);
}

:deep(.c-badge) {
  background-color: var(--color-blue-500);
  color: var(--color-white);
}

:deep(.s-badge) {
  background-color: var(--color-yellow-500);
}
</style>
