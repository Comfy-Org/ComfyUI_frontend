<template>
  <div class="flex flex-col gap-2 p-2 overflow-hidden rounded-lg">
    <!-- Thumbnail: gray placeholder with centered spinner -->
    <div class="relative aspect-square overflow-hidden rounded-lg">
      <div
        class="absolute inset-0 flex items-center justify-center bg-modal-card-placeholder-background"
      >
        <i
          class="icon-[lucide--loader-circle] size-8 animate-spin text-muted-foreground"
        />
      </div>
    </div>

    <div class="flex gap-1.5 justify-center items-center h-5">
      <!-- Progress bar -->
      <div
        v-if="hasProgressPercent(progressPercent)"
        class="flex-1 relative h-1 rounded-sm bg-secondary-background"
      >
        <div
          :class="progressBarPrimaryClass"
          :style="progressPercentStyle(progressPercent)"
        />
      </div>

      <!-- Status text only -->
      <div class="truncate text-center text-sm text-muted-foreground">
        {{ statusText }}
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'

import type { JobListItem } from '@/composables/queue/useJobList'
import { useProgressBarBackground } from '@/composables/useProgressBarBackground'

const { job } = defineProps<{ job: JobListItem }>()

const { progressBarPrimaryClass, hasProgressPercent, progressPercentStyle } =
  useProgressBarBackground()

const statusText = computed(() => job.title)
const progressPercent = computed(() =>
  job.state === 'running' ? job.progressTotalPercent : undefined
)
</script>
