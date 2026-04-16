<script setup lang="ts">
import { cn } from '@comfyorg/tailwind-utils'

const {
  href,
  label,
  variant = 'solid',
  size = 'sm',
  className = ''
} = defineProps<{
  href: string
  label?: string
  variant?: 'solid' | 'outline'
  size?: 'sm' | 'lg'
  className?: string
}>()

const sizeClass =
  size === 'lg'
    ? 'rounded-full px-8 py-4 text-sm font-bold tracking-wider'
    : 'rounded-2xl px-4 py-2 text-sm font-semibold'
</script>

<template>
  <a
    :href="href"
    :class="
      cn(
        sizeClass,
        className,
        variant === 'solid'
          ? 'bg-primary-comfy-yellow text-primary-comfy-ink transition-opacity hover:opacity-90'
          : 'border-primary-comfy-yellow text-primary-comfy-yellow hover:bg-primary-comfy-yellow hover:text-primary-comfy-ink border transition-colors'
      )
    "
  >
    <slot>{{ label }}</slot>
  </a>
</template>
