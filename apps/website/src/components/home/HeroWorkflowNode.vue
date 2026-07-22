<script setup lang="ts">
import { cn } from '@comfyorg/tailwind-utils'
import { ChevronDown } from '@lucide/vue'

import type { HTMLAttributes } from 'vue'

import type { NodeRunState } from './useHeroWorkflowRun'

const {
  title,
  state = 'idle',
  progress = 0,
  class: customClass = ''
} = defineProps<{
  title: string
  state?: NodeRunState
  progress?: number
  class?: HTMLAttributes['class']
}>()
</script>

<template>
  <div
    :class="
      cn(
        'bg-hero-node overflow-hidden rounded-xl border shadow-xl shadow-black/30 transition-colors duration-300',
        state === 'running' ? 'border-hero-exec' : 'border-white/10',
        customClass
      )
    "
  >
    <div class="flex items-center gap-1.5 px-3 py-2">
      <ChevronDown class="size-3.5 shrink-0 text-white/35" />
      <span class="truncate text-[13px] font-medium text-white/85">
        {{ title }}
      </span>
    </div>
    <div class="h-0.5 bg-white/5">
      <div
        :class="
          cn(
            'bg-hero-exec h-full',
            state === 'running' && 'transition-[width] duration-100 ease-linear'
          )
        "
        :style="{ width: `${state === 'running' ? progress * 100 : 0}%` }"
      />
    </div>
    <div class="p-2">
      <slot />
    </div>
  </div>
</template>
