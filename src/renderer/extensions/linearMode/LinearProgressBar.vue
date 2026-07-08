<script setup lang="ts">
import { useQueueProgress } from '@/composables/queue/useQueueProgress'
import { useExecutionStore } from '@/stores/executionStore'
import { cn } from '@comfyorg/tailwind-utils'

const {
  class: className,
  overallOpacity = 1,
  activeOpacity = 1
} = defineProps<{
  class?: string
  overallOpacity?: number
  activeOpacity?: number
}>()

const { totalPercent, currentNodePercent } = useQueueProgress()
const executionStore = useExecutionStore()
</script>
<template>
  <div
    :class="
      cn(
        'relative h-2 bg-secondary-background transition-opacity',
        !executionStore.isActiveWorkflowRunning && 'opacity-0',
        className
      )
    "
  >
    <div
      data-testid="linear-progress-overall"
      class="absolute inset-0 h-full bg-interface-panel-job-progress-primary transition-[width]"
      :style="{ width: `${totalPercent}%`, opacity: overallOpacity }"
    />
    <div
      data-testid="linear-progress-node"
      class="absolute inset-0 h-full bg-interface-panel-job-progress-secondary transition-[width]"
      :style="{ width: `${currentNodePercent}%`, opacity: activeOpacity }"
    />
  </div>
</template>
