<script setup lang="ts">
import { cn } from '@comfyorg/tailwind-utils'
import type { HTMLAttributes } from 'vue'

const { class: className } = defineProps<{
  class?: HTMLAttributes['class']
}>()
</script>

<template>
  <div
    :class="
      cn(
        'flex items-center justify-between gap-1 border-t border-border-default px-3 py-2',
        className
      )
    "
  >
    <slot />
  </div>
</template>
