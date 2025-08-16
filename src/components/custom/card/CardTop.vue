<template>
  <div :class="topStyle">
    <slot class="absolute top-0 left-0 w-full h-full"></slot>

    <div class="absolute top-2 left-2 flex gap-2">
      <slot name="top-left"></slot>
    </div>

    <div class="absolute top-2 right-2 flex gap-2">
      <slot name="top-right"></slot>
    </div>

    <div class="absolute bottom-2 left-2 flex gap-2">
      <slot name="bottom-left"></slot>
    </div>

    <div class="absolute bottom-2 right-2 flex gap-2">
      <slot name="bottom-right"></slot>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'

const { ratio = 'square' } = defineProps<{
  ratio?: 'square' | 'landscape'
}>()

const topStyle = computed(() => {
  const baseClasses = 'relative p-0'

  const ratioClasses = {
    square: 'aspect-[1/1]',
    landscape: 'aspect-[48/27]'
  }

  return `${baseClasses} ${ratioClasses[ratio]}`
})
</script>
