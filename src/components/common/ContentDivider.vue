<template>
  <hr
    :class="{
      'm-0': true,
      'border-t': orientation === 'horizontal',
      'border-l': orientation === 'vertical',
      'h-full': orientation === 'vertical',
      'w-full': orientation === 'horizontal'
    }"
    :style="{
      borderColor: '#DCDAE1',
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
