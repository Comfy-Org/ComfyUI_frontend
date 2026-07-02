<script setup lang="ts">
import type { HTMLAttributes } from 'vue'

import { cn } from '@comfyorg/tailwind-utils'

const { class: className } = defineProps<{
  class?: HTMLAttributes['class']
}>()
</script>

<template>
  <div
    :class="
      cn(
        'flex items-center justify-between border-b border-border-default bg-secondary-background-hover px-3 py-1.5 text-muted-foreground',
        className
      )
    "
  >
    <slot />
  </div>
</template>
