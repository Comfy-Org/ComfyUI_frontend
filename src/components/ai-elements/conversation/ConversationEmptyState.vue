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
        'flex min-h-0 flex-1 flex-col items-center justify-center gap-4 overflow-hidden p-8 text-center',
        className
      )
    "
  >
    <slot />
  </div>
</template>
