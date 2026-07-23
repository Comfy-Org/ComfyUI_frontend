<script setup lang="ts">
import type { HTMLAttributes } from 'vue'

import { cn } from '@comfyorg/tailwind-utils'

const { class: className } = defineProps<{
  class?: HTMLAttributes['class']
}>()
</script>

<template>
  <span
    data-slot="attachment-title"
    :class="cn('block max-w-full min-w-0 truncate font-medium', className)"
  >
    <slot />
  </span>
</template>
