<script setup lang="ts">
import { ChevronDown } from '@lucide/vue'

import { cn } from '@comfyorg/tailwind-utils'

const {
  label,
  value,
  expanded,
  disabled = false
} = defineProps<{
  label?: string
  value: string
  expanded?: boolean
  disabled?: boolean
}>()
</script>

<template>
  <button
    type="button"
    :aria-expanded="expanded"
    :disabled
    :class="
      cn(
        'flex h-8 shrink-0 items-center gap-1.5 rounded-full bg-transparency-white-t4 pr-2 pl-2.5 text-xs text-primary-warm-white transition hover:bg-transparency-white-t8 focus-visible:ring-3 focus-visible:ring-primary-comfy-yellow/50 focus-visible:outline-none disabled:opacity-40',
        expanded && 'bg-transparency-white-t20 hover:bg-transparency-white-t20'
      )
    "
  >
    <slot />
    <span v-if="label" class="text-primary-warm-gray">{{ label }}</span>
    <span class="max-w-28 truncate">{{ value }}</span>
    <ChevronDown
      :class="
        cn(
          'size-3 text-primary-warm-gray transition-transform',
          expanded && 'rotate-180'
        )
      "
      aria-hidden="true"
    />
  </button>
</template>
