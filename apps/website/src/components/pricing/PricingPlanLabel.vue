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
        'text-base font-bold tracking-wider whitespace-nowrap text-primary-comfy-yellow uppercase',
        className
      )
    "
  >
    {{ label }}
  </span>
</template>
