<script setup lang="ts">
import { useQueueProgress } from '@/composables/queue/useQueueProgress'
import { useExecutionStore } from '@/stores/executionStore'
import { cn } from '@/utils/tailwindUtil'

defineOptions({ inheritAttrs: false })

const {
  class: className,
  overallOpacity = 1,
  activeOpacity = 1,
  rounded = false
} = defineProps<{
  class?: string
  overallOpacity?: number
  activeOpacity?: number
  rounded?: boolean
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
        rounded && 'rounded-sm',
        className
      )
    "
  >
    <div
      class="absolute inset-0 h-full bg-interface-panel-job-progress-primary transition-[width]"
      :class="cn(rounded && 'rounded-sm')"
      :style="{ width: `${totalPercent}%`, opacity: overallOpacity }"
    />
    <div
      class="absolute inset-0 h-full bg-interface-panel-job-progress-secondary transition-[width]"
      :class="cn(rounded && 'rounded-sm')"
      :style="{ width: `${currentNodePercent}%`, opacity: activeOpacity }"
    />
  </div>
</template>
