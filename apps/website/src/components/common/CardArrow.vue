<script setup lang="ts">
import { cn } from '@comfyorg/tailwind-utils'
import { ChevronRight } from '@lucide/vue'

import type { HTMLAttributes } from 'vue'

const { hover = 'self', class: className } = defineProps<{
  hover?: 'self' | 'group'
  class?: HTMLAttributes['class']
}>()
</script>

<template>
  <div
    :class="
      cn(
        'flex size-10 items-center justify-center rounded-2xl bg-white/20 text-white backdrop-blur-sm transition-colors',
        hover === 'group'
          ? 'group-hover:bg-primary-comfy-yellow group-hover:text-primary-comfy-ink'
          : 'hover:bg-primary-comfy-yellow hover:text-primary-comfy-ink',
        className
      )
    "
    aria-hidden="true"
  >
    <ChevronRight class="size-5" :stroke-width="2" />
  </div>
</template>
