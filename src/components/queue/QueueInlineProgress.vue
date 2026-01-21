<template>
  <div
    v-if="shouldShow"
    aria-hidden="true"
    class="pointer-events-none absolute inset-x-0 bottom-0 h-[3px]"
  >
    <div
      class="pointer-events-none absolute inset-y-0 left-0 h-full bg-interface-panel-job-progress-primary transition-[width]"
      :style="{ width: `${totalPercent}%` }"
    />
    <div
      class="pointer-events-none absolute inset-y-0 left-0 h-full bg-interface-panel-job-progress-secondary transition-[width]"
      :style="{ width: `${currentNodePercent}%` }"
    />
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'

import { useQueueProgress } from '@/composables/queue/useQueueProgress'

const { hidden = false } = defineProps<{
  hidden?: boolean
}>()

const { totalPercent, currentNodePercent } = useQueueProgress()

const shouldShow = computed(
  () => !hidden && (totalPercent.value > 0 || currentNodePercent.value > 0)
)
</script>
