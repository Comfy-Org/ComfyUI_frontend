<template>
  <div :class="containerStyle">
    <slot name="top"></slot>
    <slot name="bottom"></slot>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'

const { ratio = 'square' } = defineProps<{
  ratio?: 'square' | 'portrait' | 'tallPortrait'
}>()

const containerStyle = computed(() => {
  const baseClasses =
    'flex flex-col bg-white dark-theme:bg-zinc-800 rounded-lg shadow-sm border border-zinc-200 dark-theme:border-zinc-700 overflow-hidden'

  const ratioClasses = {
    square: 'aspect-[256/308]',
    portrait: 'aspect-[256/325]',
    tallPortrait: 'aspect-[256/353]'
  }

  return `${baseClasses} ${ratioClasses[ratio]}`
})
</script>
