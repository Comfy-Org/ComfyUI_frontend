<script setup lang="ts">
import { cn } from '@comfyorg/tailwind-utils'
import type { HTMLAttributes } from 'vue'

const { class: className } = defineProps<{
  class?: HTMLAttributes['class']
}>()
</script>

<template>
  <div
    data-slot="card-description"
    :class="
      cn('line-clamp-3 text-base text-primary-comfy-canvas/70', className)
    "
  >
    <slot />
  </div>
</template>
