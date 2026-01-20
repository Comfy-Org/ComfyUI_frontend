<template>
  <div :class="chipClasses">
    <slot name="icon" />
    <span>{{ label }}</span>
  </div>
</template>
<script setup lang="ts">
import { computed } from 'vue'

import { cn } from '@/utils/tailwindUtil'

const { label, variant = 'dark' } = defineProps<{
  label: string
  variant?: 'dark' | 'light' | 'gray'
}>()

const baseClasses =
  'inline-flex shrink-0 items-center justify-center gap-1 rounded px-2 py-1 text-xs font-bold'

const variantStyles = {
  dark: 'bg-zinc-500/40 text-white/90',
  light: cn('bg-base-background/50 text-base-foreground backdrop-blur-[2px]'),
  gray: cn(
    'bg-modal-card-tag-background text-base-foreground backdrop-blur-[2px]'
  )
}

const chipClasses = computed(() => {
  return cn(baseClasses, variantStyles[variant])
})
</script>
