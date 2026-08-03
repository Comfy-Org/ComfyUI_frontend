<script setup lang="ts">
import type { HTMLAttributes } from 'vue'
import { cn } from '@comfyorg/tailwind-utils'

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
