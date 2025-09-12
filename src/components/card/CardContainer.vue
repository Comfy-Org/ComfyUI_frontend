<template>
  <div :class="containerClasses">
    <slot name="top"></slot>
    <slot name="bottom"></slot>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'

const { ratio = 'square' } = defineProps<{
  ratio?: 'square' | 'portrait' | 'tallPortrait'
}>()

const containerClasses = computed(() => {
  const baseClasses =
    'flex flex-col hover:bg-white dark-theme:hover:bg-zinc-800 rounded-lg hover:shadow-sm hover:border hover:border-zinc-200 dark-theme:hover:border-zinc-700 overflow-hidden hover:p-2'

  const ratioClasses = {
    square: 'aspect-256/308',
    portrait: 'aspect-256/325',
    tallPortrait: 'aspect-256/353',
    none: ''
  }

  return `${baseClasses} ${ratioClasses[ratio]}`
})
</script>
