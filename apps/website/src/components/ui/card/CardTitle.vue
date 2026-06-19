<script setup lang="ts">
import type { HTMLAttributes } from 'vue'
import { cn } from '@comfyorg/tailwind-utils'

const { class: className } = defineProps<{
  class?: HTMLAttributes['class']
}>()
</script>

<template>
  <div
    data-slot="card-title"
    :class="
      cn(
        'text-xl leading-none font-medium text-primary-comfy-canvas md:text-2xl',
        className
      )
    "
  >
    <slot />
  </div>
</template>
