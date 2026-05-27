<script setup lang="ts">
import { cn } from '@comfyorg/tailwind-utils'

const { class: className } = defineProps<{ class?: string }>()
</script>

<template>
  <span
    :class="
      cn(
        'text-primary-warm-gray bg-transparency-ink-t80 inline-flex items-center rounded-full px-4 py-1 text-xs',
        className
      )
    "
  >
    <slot />
  </span>
</template>
