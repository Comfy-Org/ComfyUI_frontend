<template>
  <div :class="containerClasses">
    <slot name="top"></slot>
    <slot name="bottom"></slot>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'

import { cn } from '@/utils/tailwindUtil'

const {
  size = 'regular',
  variant = 'default',
  rounded = 'md',
  customAspectRatio,
  noBorder = false,
  noBackground = false,
  noShadow = false,
  noCursor = false,
  class: customClass = ''
} = defineProps<{
  size?: 'mini' | 'compact' | 'regular' | 'portrait' | 'tall'
  variant?: 'default' | 'ghost' | 'outline'
  rounded?: 'none' | 'md' | 'lg' | 'xl'
  customAspectRatio?: string
  noBorder?: boolean
  noBackground?: boolean
  noShadow?: boolean
  noCursor?: boolean
  class?: string
}>()

const containerClasses = computed(() => {
  // Base structure classes
  const structureClasses = 'flex flex-col overflow-hidden'

  // Rounded corners
  const roundedClasses = {
    none: 'rounded-none',
    md: 'rounded',
    lg: 'rounded-lg',
    xl: 'rounded-xl'
  }
  // Variant styles
  const variantClasses = {
    default: cn(
      !noBackground && 'bg-white dark-theme:bg-zinc-800',
      !noBorder && 'border border-zinc-200 dark-theme:border-zinc-700',
      !noShadow && 'shadow-sm',
      !noCursor && 'cursor-pointer'
    ),
    ghost: cn(
      !noCursor && 'cursor-pointer',
      'p-2 transition-colors duration-200'
    ),
    outline: cn(
      !noBorder && 'border-2 border-zinc-300 dark-theme:border-zinc-600',
      !noCursor && 'cursor-pointer',
      'hover:border-zinc-400 dark-theme:hover:border-zinc-500 transition-colors'
    )
  }

  // Size/aspect ratio
  const aspectRatio = customAspectRatio
    ? `aspect-[${customAspectRatio}]`
    : {
        mini: 'aspect-100/115',
        compact: 'aspect-240/311',
        regular: 'aspect-256/308',
        portrait: 'aspect-256/325',
        tall: 'aspect-256/353'
      }[size]

  return cn(
    structureClasses,
    roundedClasses[rounded],
    variantClasses[variant],
    aspectRatio,
    customClass
  )
})
</script>
