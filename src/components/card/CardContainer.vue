<template>
  <div :class="containerClasses">
    <slot name="top"></slot>
    <slot name="bottom"></slot>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'

const { ratio = 'square', type } = defineProps<{
  ratio?: 'smallSquare' | 'square' | 'portrait' | 'tallPortrait'
  type?: string
}>()

const containerClasses = computed(() => {
  const baseClasses =
    'cursor-pointer flex flex-col bg-white dark-theme:bg-zinc-800 rounded-lg shadow-sm border border-zinc-200 dark-theme:border-zinc-700 overflow-hidden'

  if (type === 'workflow-template-card') {
    return `cursor-pointer flex flex-col bg-white dark-theme:bg-zinc-900 rounded-lg shadow-sm border border-zinc-200 dark-theme:border-zinc-700 overflow-hidden hover:bg-white dark-theme:hover:bg-zinc-800 transition-background duration-200 ease-in-out`
  }

  const ratioClasses = {
    smallSquare: 'aspect-240/311',
    square: 'aspect-256/308',
    portrait: 'aspect-256/325',
    tallPortrait: 'aspect-256/353'
  }

  return `${baseClasses} ${ratioClasses[ratio]}`
})
</script>
