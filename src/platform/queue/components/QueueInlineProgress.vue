<template>
  <div
    v-if="shouldShow"
    data-testid="queue-inline-progress"
    aria-hidden="true"
    :class="
      cn('pointer-events-none absolute inset-0 overflow-hidden', radiusClass)
    "
  >
    <ProgressFill
      :progress="totalPercent / 100"
      class="pointer-events-none absolute bottom-0 left-0 h-[3px] w-full bg-primary"
    />
    <ProgressFill
      :progress="currentNodePercent / 100"
      data-testid="queue-inline-progress-node-fill"
      class="pointer-events-none absolute bottom-0 left-0 h-[3px] w-full bg-primary/30"
    />
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'

import ProgressFill from '@/components/common/ProgressFill.vue'
import { useQueueProgress } from '@/platform/execution/composables/useQueueProgress'
import { cn } from '@comfyorg/tailwind-utils'

const { hidden = false, radiusClass = 'rounded-[7px]' } = defineProps<{
  hidden?: boolean
  radiusClass?: string
}>()

const { totalPercent, currentNodePercent } = useQueueProgress()

const shouldShow = computed(
  () => !hidden && (totalPercent.value > 0 || currentNodePercent.value > 0)
)
</script>
