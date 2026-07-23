<script setup lang="ts">
import type { HTMLAttributes } from 'vue'

import { cn } from '@comfyorg/tailwind-utils'

const { class: className } = defineProps<{
  class?: HTMLAttributes['class']
}>()
</script>

<template>
  <div
    data-slot="attachment-content"
    :class="cn('max-w-full min-w-0 flex-1 leading-tight', className)"
  >
    <slot />
  </div>
</template>
