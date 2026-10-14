<template>
  <tr
    :class="
      cn(
        'border-b border-border-subtle/60 transition-colors hover:bg-secondary/50 focus-visible:outline-1 focus-visible:-outline-offset-1 focus-visible:outline-border data-[state=selected]:bg-secondary/50',
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
