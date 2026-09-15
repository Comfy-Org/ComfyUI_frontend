<script setup lang="ts">
import type { HTMLAttributes } from 'vue'
import { computed } from 'vue'

import { cn } from '@comfyorg/tailwind-utils'

const {
  class: className,
  width,
  height,
  borderRadius,
  shape
} = defineProps<{
  class?: HTMLAttributes['class']
  width?: string
  height?: string
  borderRadius?: string
  shape?: 'circle' | 'rectangle'
}>()

const style = computed(() => ({
  width,
  height,
  borderRadius: shape === 'circle' ? '50%' : borderRadius
}))
</script>

<template>
  <div
    :class="
      cn(
        'animate-pulse bg-secondary-background',
        shape === 'circle' ? 'rounded-full' : 'rounded-md',
        className
      )
    "
    :style
  />
</template>
