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
        'text-foreground flex h-8 w-full cursor-pointer items-center justify-start gap-2 rounded-full border-0 bg-secondary-background px-3 text-sm whitespace-nowrap transition-colors outline-none hover:bg-secondary-background-hover @[460px]:w-auto',
        className
      )
    "
    @click="emit('select', suggestion)"
  >
    <slot />
  </button>
</template>
