<script setup lang="ts">
import type { HTMLAttributes } from 'vue'

import { cn } from '@comfyorg/tailwind-utils'

const { class: className } = defineProps<{
  class?: HTMLAttributes['class']
}>()
</script>

<template>
  <div
    data-slot="attachment-actions"
    :class="cn('relative flex shrink-0 items-center gap-1', className)"
  >
    <slot />
  </div>
</template>
