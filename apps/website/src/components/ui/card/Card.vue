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
        'bg-transparency-ink-t80 text-primary-warm-white flex flex-col gap-6 rounded-3xl border shadow-sm',
        className
      )
    "
  >
    <slot />
  </div>
</template>
