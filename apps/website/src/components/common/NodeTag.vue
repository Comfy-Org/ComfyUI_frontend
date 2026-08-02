<script setup lang="ts">
import { cn } from '@comfyorg/tailwind-utils'

import type { HTMLAttributes } from 'vue'

const { class: className } = defineProps<{ class?: HTMLAttributes['class'] }>()
</script>

<template>
  <span
    :class="
      cn(
        'inline-flex h-8 -skew-x-12 items-center justify-center rounded-lg px-3.5',
        className
      )
    "
  >
    <span
      class="ppformula-text-center font-formula skew-x-12 text-sm leading-none font-extrabold tracking-wider uppercase"
    >
      <slot />
    </span>
  </span>
</template>
