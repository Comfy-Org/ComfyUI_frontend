<script setup lang="ts">
import type { HTMLAttributes } from 'vue'
import { cn } from '@comfyorg/tailwind-utils'

const { class: className } = defineProps<{
  class?: HTMLAttributes['class']
}>()
</script>

<template>
  <div
    data-slot="card"
    :class="
      cn(
        'flex flex-col gap-6 rounded-4.5xl bg-transparency-white-t4 text-primary-warm-white shadow-sm',
        className
      )
    "
  >
    <slot />
  </div>
</template>
