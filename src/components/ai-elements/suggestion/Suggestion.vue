<script setup lang="ts">
import { cn } from '@comfyorg/tailwind-utils'
import type { HTMLAttributes } from 'vue'

const { suggestion, class: className } = defineProps<{
  suggestion: string
  class?: HTMLAttributes['class']
}>()

const emit = defineEmits<{
  select: [suggestion: string]
}>()
</script>

<template>
  <button
    type="button"
    :class="
      cn(
        'flex h-8 w-full items-center justify-center gap-1 rounded-full bg-secondary-background/40 px-3 text-xs font-medium text-base-foreground opacity-70 transition-opacity hover:opacity-100',
        className
      )
    "
    @click="emit('select', suggestion)"
  >
    <slot />
  </button>
</template>
