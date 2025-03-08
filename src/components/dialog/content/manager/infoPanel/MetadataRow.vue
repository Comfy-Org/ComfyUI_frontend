<template>
  <div class="flex py-1.5 text-xs">
    <div class="w-1/3 text-color-secondary truncate pr-2 text-muted">
      {{ label }}:
    </div>
    <div class="w-2/3">
      <slot>{{ value }}</slot>
    </div>
  </div>
</template>

<script setup lang="ts">
const { value = 'N/A' } = defineProps<{
  label: string
  value?: string | number
}>()
</script>
