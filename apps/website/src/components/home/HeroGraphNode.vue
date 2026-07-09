<script setup lang="ts">
import { cn } from '@comfyorg/tailwind-utils'

import type { HTMLAttributes } from 'vue'

const {
  label,
  active = false,
  class: customClass = ''
} = defineProps<{
  label: string
  active?: boolean
  class?: HTMLAttributes['class']
}>()
</script>

<template>
  <div
    :class="
      cn(
        'bg-primary-comfy-ink-light rounded-3xl p-2.5',
        active && 'ring-primary-comfy-yellow/70 ring-1',
        customClass
      )
    "
  >
    <div class="flex items-center justify-between px-1.5 pt-1 pb-2.5">
      <span class="bg-primary-comfy-yellow size-2 rounded-full" />
      <span
        class="text-xs leading-[1.1] font-bold tracking-[-0.01em] text-primary-comfy-canvas uppercase"
      >
        {{ label }}
      </span>
    </div>
    <slot />
  </div>
</template>
