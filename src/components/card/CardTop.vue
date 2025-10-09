<template>
  <div :class="topStyle">
    <slot class="absolute top-0 left-0 h-full w-full"></slot>

    <div
      v-if="slots['top-left']"
      class="absolute top-2 left-2 flex flex-wrap justify-start gap-2"
    >
      <slot name="top-left"></slot>
    </div>

    <div
      v-if="slots['top-right']"
      class="absolute top-2 right-2 flex flex-wrap justify-end gap-2"
    >
      <slot name="top-right"></slot>
    </div>

    <div
      v-if="slots['bottom-left']"
      class="absolute bottom-2 left-2 flex flex-wrap justify-start gap-2"
    >
      <slot name="bottom-left"></slot>
    </div>

    <div
      v-if="slots['bottom-right']"
      class="absolute right-2 bottom-2 flex flex-wrap justify-end gap-2"
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
