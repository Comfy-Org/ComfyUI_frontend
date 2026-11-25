<template>
  <div
    :class="
      cn(
        'pointer-events-none absolute h-2 overflow-hidden',
        collapsed
          ? '-bottom-px left-4 w-full translate-y-1/2 rounded-full'
          : 'inset-x-0 top-1/2 -translate-y-1/2'
      )
    "
  >
    <ProgressFill
      :progress
      mode="translate"
      data-testid="node-progress-fill"
      :class="
        cn(
          'size-full bg-primary',
          collapsed ? 'rounded-full' : progress < 1 && 'rounded-r-full'
        )
      "
    />
  </div>
</template>

<script setup lang="ts">
import { cn } from '@comfyorg/tailwind-utils'

import ProgressFill from '@/components/common/ProgressFill.vue'

const { progress, collapsed = false } = defineProps<{
  progress: number
  collapsed?: boolean
}>()
</script>
