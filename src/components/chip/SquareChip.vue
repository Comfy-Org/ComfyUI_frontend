<template>
  <div :class="chipClasses">
    <slot name="icon"></slot>
    <span>{{ label }}</span>
  </div>
</template>
<script setup lang="ts">
import { computed } from 'vue'

import { cn } from '@/utils/tailwindUtil'

const { label, variant = 'dark' } = defineProps<{
  label: string
  variant?: 'dark' | 'light'
}>()

const baseClasses =
  'inline-flex shrink-0 items-center justify-center gap-1 rounded px-2 py-1 text-xs font-bold'

const variantStyles = {
  dark: 'bg-zinc-500/40 text-white/90',
  light: 'backdrop-blur-[2px] bg-white/50 text-zinc-900 dark-theme:text-white'
}

const chipClasses = computed(() => {
  return cn(baseClasses, variantStyles[variant])
})
</script>
