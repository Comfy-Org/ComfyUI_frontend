<template>
  <hr
    :class="{
      'm-0': true,
      'border-t': orientation === 'horizontal',
      'border-l': orientation === 'vertical',
      'border-surface-300': true,
      'h-full': orientation === 'vertical',
      'w-full': orientation === 'horizontal'
    }"
    :style="{
      borderWidth: `${width}px !important`
    }"
  />
</template>

<script setup lang="ts">
const { orientation = 'horizontal', width = 0.3 } = defineProps<{
  orientation?: 'horizontal' | 'vertical'
  width?: number
}>()
</script>
