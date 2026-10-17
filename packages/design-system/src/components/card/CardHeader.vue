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
        'flex h-12 shrink-0 items-center justify-between gap-2 border-b px-4',
        className
      )
    "
  >
    <slot />
  </div>
</template>
