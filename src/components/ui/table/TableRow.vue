<template>
  <tr
    :class="
      cn(
        'border-b border-interface-stroke/60 transition-colors hover:bg-secondary-background/50 data-[state=selected]:bg-secondary-background/50',
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
