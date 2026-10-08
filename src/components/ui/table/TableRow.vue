<template>
  <tr
    :class="
      cn(
        'border-b border-border-subtle/60 transition-colors hover:bg-secondary-background/50 focus-visible:outline-1 focus-visible:-outline-offset-1 focus-visible:outline-border-default data-[state=selected]:bg-secondary-background/50',
        className
      )
    "
  >
    <slot />
  </tr>
</template>

<script setup lang="ts">
import type { HTMLAttributes } from 'vue'

import { cn } from '@comfyorg/tailwind-utils'

const { class: className } = defineProps<{ class?: HTMLAttributes['class'] }>()
</script>
