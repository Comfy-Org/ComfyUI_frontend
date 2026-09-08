<script setup lang="ts">
import type { HTMLAttributes } from 'vue'

import { cn } from '@comfyorg/tailwind-utils'

const { class: className } = defineProps<{
  label: string
  class?: HTMLAttributes['class']
}>()
</script>

<template>
  <span
    :class="
      cn(
        'text-primary-comfy-yellow text-base font-bold tracking-wider whitespace-nowrap uppercase',
        className
      )
    "
  >
    {{ label }}
  </span>
</template>
