<script setup lang="ts">
import { cn } from '@/utils/tailwindUtil'

const {
  text,
  icon,
  iconClass,
  variant = 'default'
} = defineProps<{
  text?: string
  icon?: string
  iconClass?: string
  variant?: 'default' | 'highlight'
}>()
</script>

<template>
  <span
    :class="
      cn(
        'flex items-center gap-1 rounded px-1.5 py-0.5',
        variant === 'highlight'
          ? 'bg-[var(--primary-background)] text-base-foreground'
          : 'border border-border-default'
      )
    "
  >
    <i v-if="icon" :class="cn(icon, 'size-2.5', iconClass)" />
    <slot
      ><span class="text-xxs">{{ text }}</span></slot
    >
  </span>
</template>
