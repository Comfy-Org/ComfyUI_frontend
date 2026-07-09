<script setup lang="ts">
import { cn } from '@comfyorg/tailwind-utils'

import type { HTMLAttributes } from 'vue'

const {
  label,
  accent = false,
  active = false,
  class: customClass = ''
} = defineProps<{
  label: string
  accent?: boolean
  active?: boolean
  class?: HTMLAttributes['class']
}>()
</script>

<template>
  <div
    :class="
      cn(
        'bg-transparency-ink-t80 rounded-2xl border p-3 transition-colors duration-500 ease-out',
        accent ? 'border-primary-comfy-yellow' : 'border-white/10',
        active && 'border-primary-comfy-yellow/70',
        customClass
      )
    "
  >
    <span
      class="text-primary-warm-gray flex items-center gap-1.5 pl-1 text-[0.7rem] font-medium tracking-[0.22em] uppercase"
    >
      <span
        :class="
          cn(
            'size-1.5 rounded-full',
            accent || active ? 'bg-primary-comfy-yellow' : 'bg-white/25'
          )
        "
      />
      {{ label }}
    </span>
    <div class="mt-2">
      <slot />
    </div>
  </div>
</template>
