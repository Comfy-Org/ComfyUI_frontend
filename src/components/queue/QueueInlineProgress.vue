<template>
  <div
    v-if="shouldShow"
    data-testid="queue-inline-progress"
    aria-hidden="true"
    :class="
      cn('pointer-events-none absolute inset-0 overflow-hidden', radiusClass)
    "
  >
    <div
      ref="totalFillRef"
      class="pointer-events-none absolute bottom-0 left-0 h-[3px] w-full origin-left scale-x-0 bg-primary"
    />
    <div
      ref="currentNodeFillRef"
      data-testid="queue-inline-progress-node-fill"
      class="pointer-events-none absolute bottom-0 left-0 h-[3px] w-full origin-left scale-x-0 bg-primary/30"
    />
  </div>
</template>

<script setup lang="ts">
import { computed, useTemplateRef } from 'vue'

import { useQueueProgress } from '@/composables/queue/useQueueProgress'
import { useCompositedProgress } from '@/renderer/core/layout/transform/useCompositedProgress'
import { cn } from '@comfyorg/tailwind-utils'

const { hidden = false, radiusClass = 'rounded-[7px]' } = defineProps<{
  hidden?: boolean
  radiusClass?: string
}>()

const { totalPercent, currentNodePercent } = useQueueProgress()

const shouldShow = computed(
  () => !hidden && (totalPercent.value > 0 || currentNodePercent.value > 0)
)

const SCALE_X_KEYFRAMES = [{ scale: '0 1' }, { scale: '1 1' }]
useCompositedProgress(
  useTemplateRef('totalFillRef'),
  () => totalPercent.value / 100,
  SCALE_X_KEYFRAMES
)
useCompositedProgress(
  useTemplateRef('currentNodeFillRef'),
  () => currentNodePercent.value / 100,
  SCALE_X_KEYFRAMES
)
</script>
