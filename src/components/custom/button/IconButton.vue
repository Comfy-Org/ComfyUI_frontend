<template>
  <button :class="buttonStyle" role="button" @click="onClick">
    <slot></slot>
  </button>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { HTMLAttributes } from 'vue'

const {
  size = 'md',
  class: className,
  onClick
} = defineProps<{
  size?: 'sm' | 'md'
  class?: HTMLAttributes['class']
  onClick: (event: Event) => void
}>()

const buttonStyle = computed(() => {
  const baseClasses =
    'flex justify-center items-center flex-shrink-0 outline-none border-none p-0 bg-white text-neutral-950 dark-theme:bg-zinc-700 dark-theme:text-white cursor-pointer'

  const sizeClasses =
    size === 'sm' ? 'w-6 h-6 text-xs rounded-md' : 'w-8 h-8 text-sm rounded-lg'

  return [baseClasses, sizeClasses, className].filter(Boolean).join(' ')
})
</script>
