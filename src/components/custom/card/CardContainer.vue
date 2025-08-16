<template>
  <div :class="containerClasses" :style="containerStyle">
    <slot name="top"></slot>
    <slot name="bottom"></slot>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'

const {
  ratio = 'square',
  maxWidth,
  minWidth
} = defineProps<{
  maxWidth: number
  minWidth: number
  ratio?: 'square' | 'portrait' | 'tallPortrait'
}>()

const containerClasses = computed(() => {
  const baseClasses =
    'flex flex-col bg-white dark-theme:bg-zinc-800 rounded-lg shadow-sm border border-zinc-200 dark-theme:border-zinc-700 overflow-hidden'

  const ratioClasses = {
    square: 'aspect-[256/308]',
    portrait: 'aspect-[256/325]',
    tallPortrait: 'aspect-[256/353]'
  }

  return `${baseClasses} ${ratioClasses[ratio]}`
})

const containerStyle = computed(() => ({
  maxWidth: `${maxWidth}px`,
  minWidth: `${minWidth}px`
}))
</script>
