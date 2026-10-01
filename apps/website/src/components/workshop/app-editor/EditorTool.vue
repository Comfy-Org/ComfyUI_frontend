<script setup lang="ts">
import type { Component } from 'vue'

import { cn } from '@comfyorg/tailwind-utils'

const {
  icon,
  label,
  pressed,
  iconOnly = false,
  disabled = false
} = defineProps<{
  icon: Component
  label: string
  pressed?: boolean
  iconOnly?: boolean
  disabled?: boolean
}>()
</script>

<template>
  <button
    type="button"
    :aria-pressed="pressed"
    :aria-label="iconOnly ? label : undefined"
    :title="iconOnly ? label : undefined"
    :disabled
    :class="
      cn(
        'flex h-8 shrink-0 items-center justify-center gap-1.5 rounded-full text-xs text-primary-warm-gray transition hover:text-primary-warm-white focus-visible:ring-3 focus-visible:ring-primary-comfy-yellow/50 focus-visible:outline-none disabled:opacity-40 disabled:hover:text-primary-warm-gray',
        iconOnly ? 'w-8' : 'px-3',
        pressed && 'bg-transparency-white-t20 text-primary-warm-white'
      )
    "
  >
    <component :is="icon" class="size-3.5" aria-hidden="true" />
    <span v-if="!iconOnly" class="max-sm:sr-only">{{ label }}</span>
  </button>
</template>
