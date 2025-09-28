<template>
  <div :class="topStyle">
    <slot class="absolute top-0 left-0 w-full h-full"></slot>

    <div
      v-if="slots['top-left']"
      class="absolute top-2 left-2 flex gap-2 flex-wrap justify-start"
    >
      <slot name="top-left"></slot>
    </div>

    <div
      v-if="slots['top-right']"
      class="absolute top-2 right-2 flex gap-2 flex-wrap justify-end"
    >
      <slot name="top-right"></slot>
    </div>

    <div
      v-if="slots['bottom-left']"
      class="absolute bottom-2 left-2 flex gap-2 flex-wrap justify-start"
    >
      <slot name="bottom-left"></slot>
    </div>

    <div
      v-if="slots['bottom-right']"
      class="absolute bottom-2 right-2 flex gap-2 flex-wrap justify-end"
    >
      <slot name="bottom-right"></slot>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, useSlots } from 'vue'

const slots = useSlots()

const { ratio = 'square' } = defineProps<{
  ratio?: 'square' | 'landscape'
}>()

const topStyle = computed(() => {
  const baseClasses = 'relative p-0'

  const ratioClasses = {
    square: 'aspect-square',
    landscape: 'aspect-48/27'
  }

  return `${baseClasses} ${ratioClasses[ratio]}`
})
</script>
