<template>
  <th
    :class="
      cn(
        'h-10 px-2 text-left align-middle text-sm font-normal text-muted-foreground',
        className
      )
    "
  >
    <slot />
  </th>
</template>

<script setup lang="ts">
import type { HTMLAttributes } from 'vue'

import { cn } from '@comfyorg/tailwind-utils'

const { class: className } = defineProps<{ class?: HTMLAttributes['class'] }>()
</script>
