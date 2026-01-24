<template>
  <div
    role="status"
    :aria-label="t('sideToolbar.activeJobStatus', { status: statusText })"
    class="flex flex-col gap-2 p-2 rounded-lg"
  >
    <!-- Thumbnail -->
    <div class="relative aspect-square overflow-hidden rounded-lg">
      <!-- Running state with preview image -->
      <img
        v-if="isRunning && previewUrl"
        :src="previewUrl"
        :alt="statusText"
        class="size-full object-cover"
      />
      <!-- Placeholder for queued/failed states or running without preview -->
      <div
        v-else
        class="absolute inset-0 flex items-center justify-center bg-modal-card-placeholder-background"
      >
        <!-- Spinner for queued/initialization states -->
        <i
          v-if="isQueued"
          class="icon-[lucide--loader-circle] size-8 animate-spin text-muted-foreground"
        />
        <!-- Error icon for failed state -->
        <i
          v-else-if="isFailed"
          class="icon-[lucide--circle-alert] size-8 text-red-500"
        />
        <!-- Spinner for running without preview -->
        <i
          v-else
          class="icon-[lucide--loader-circle] size-8 animate-spin text-muted-foreground"
        />
      </div>
    </div>

    <!-- Footer: Progress bar or status text -->
    <div class="flex gap-1.5 items-center h-5">
      <!-- Running state: percentage + progress bar -->
      <template v-if="isRunning && hasProgressPercent(progressPercent)">
        <span class="shrink-0 text-sm text-muted-foreground">
          {{ Math.round(progressPercent ?? 0) }}%
        </span>
        <div class="flex-1 relative h-1 rounded-sm bg-secondary-background">
          <div
            :class="progressBarPrimaryClass"
            :style="progressPercentStyle(progressPercent)"
          />
        </div>
      </template>
      <!-- Non-running states: status text only -->
      <template v-else>
        <div class="w-full truncate text-center text-sm text-muted-foreground">
          {{ statusText }}
        </div>
      </template>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

import type { JobListItem } from '@/composables/queue/useJobList'
import { useProgressBarBackground } from '@/composables/useProgressBarBackground'

const { job } = defineProps<{ job: JobListItem }>()

const { t } = useI18n()

const { progressBarPrimaryClass, hasProgressPercent, progressPercentStyle } =
  useProgressBarBackground()

const statusText = computed(() => job.title)
const progressPercent = computed(() => job.progressTotalPercent)
const previewUrl = computed(() => job.livePreviewUrl ?? job.iconImageUrl)

const isQueued = computed(
  () => job.state === 'pending' || job.state === 'initialization'
)
const isRunning = computed(() => job.state === 'running')
const isFailed = computed(() => job.state === 'failed')
</script>
