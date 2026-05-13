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
      class="pointer-events-none absolute bottom-0 left-0 bg-interface-panel-job-progress-primary transition-[width]"
      :style="{ height: '3px', width: `${totalPercent}%` }"
    />
    <div
      class="pointer-events-none absolute bottom-0 left-0 bg-interface-panel-job-progress-secondary transition-[width]"
      :style="{ height: '3px', width: `${currentNodePercent}%` }"
    />
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'

import { useQueueProgress } from '@/composables/queue/useQueueProgress'
import { cn } from '@comfyorg/tailwind-utils'

const { hidden = false, radiusClass = 'rounded-lg' } = defineProps<{
  hidden?: boolean
  radiusClass?: string
}>()

const { totalPercent, currentNodePercent } = useQueueProgress()

const shouldShow = computed(
  () => !hidden && (totalPercent.value > 0 || currentNodePercent.value > 0)
)
</script>
