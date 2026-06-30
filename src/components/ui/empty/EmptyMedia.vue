<script setup lang="ts">
import type { HTMLAttributes } from 'vue'

import { cn } from '@comfyorg/tailwind-utils'

const { variant = 'default', class: className } = defineProps<{
  variant?: 'default' | 'icon'
  class?: HTMLAttributes['class']
}>()
</script>

<template>
  <div
    data-slot="empty-media"
    :data-variant="variant"
    :class="
      cn(
        'mb-2 flex shrink-0 items-center justify-center [&_svg]:pointer-events-none [&_svg]:shrink-0',
        variant === 'icon' &&
          'text-foreground size-10 rounded-lg bg-muted [&_svg:not([class*=\'size-\'])]:size-6',
        className
      )
    "
  >
    <slot />
  </div>
</template>
