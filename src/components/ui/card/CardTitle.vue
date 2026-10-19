<script setup lang="ts">
import type { HTMLAttributes } from 'vue'

import { cn } from '@comfyorg/tailwind-utils'

const { class: className } = defineProps<{
  class?: HTMLAttributes['class']
}>()
</script>

<template>
  <h2
    :class="
      cn('m-0 flex min-w-0 items-center gap-2 text-sm font-normal', className)
    "
  >
    <slot />
  </h2>
</template>
