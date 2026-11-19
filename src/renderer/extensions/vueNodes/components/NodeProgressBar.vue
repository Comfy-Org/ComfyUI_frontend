<template>
  <div
    :class="
      cn(
        'absolute h-2 overflow-hidden',
        collapsed
          ? '-bottom-px left-4 w-full translate-y-1/2 rounded-full'
          : 'inset-x-0 top-1/2 -translate-y-1/2'
      )
    "
  >
    <div
      ref="fillRef"
      data-testid="node-progress-fill"
      :class="
        cn(
          'size-full -translate-x-full bg-primary',
          collapsed ? 'rounded-full' : progress < 1 && 'rounded-r-full'
        )
      "
    />
  </div>
</template>

<script setup lang="ts">
import { cn } from '@comfyorg/tailwind-utils'
import { useTemplateRef } from 'vue'

import { useCompositedProgress } from '@/renderer/core/layout/transform/useCompositedProgress'

const { progress, collapsed = false } = defineProps<{
  progress: number
  collapsed?: boolean
}>()

useCompositedProgress(useTemplateRef('fillRef'), () => progress, [
  { translate: '-100%' },
  { translate: '0%' }
])
</script>
