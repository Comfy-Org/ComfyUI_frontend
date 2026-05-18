<template>
  <div
    v-if="runningCount > 0 || queuedCount > 0"
    class="flex shrink-0 items-center gap-1.5 text-xs"
  >
    <button
      v-if="queuedCount > 0"
      v-tooltip.top="t('sideToolbar.queueProgressOverlay.clearQueueTooltip')"
      type="button"
      class="group focus-visible:ring-ring inline-flex h-6 min-w-12 cursor-pointer items-center justify-center gap-1 rounded-full border-none bg-secondary-background px-2.5 text-text-secondary tabular-nums transition-colors hover:bg-destructive-background hover:text-base-foreground focus-visible:bg-destructive-background focus-visible:text-base-foreground focus-visible:ring-1 focus-visible:outline-none"
      :aria-label="t('sideToolbar.queueProgressOverlay.clearQueueTooltip')"
      @click="emit('clearQueued')"
    >
      <i
        class="icon-[lucide--hourglass] size-3 group-hover:hidden group-focus-visible:hidden"
      />
      <i
        class="icon-[lucide--x] hidden size-3 group-hover:block group-focus-visible:block"
      />
      {{ queuedCount }}
    </button>
    <span
      v-if="runningCount > 0"
      v-tooltip.top="runningJobsLabel"
      class="inline-flex h-6 min-w-12 items-center justify-center gap-1 rounded-full bg-secondary-background px-2.5 text-text-primary tabular-nums"
      :aria-label="runningJobsLabel"
    >
      <i
        class="icon-[lucide--loader-2] size-3 animate-spin text-primary-background"
      />
      {{ runningCount }}
    </span>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

const { queuedCount, runningCount } = defineProps<{
  queuedCount: number
  runningCount: number
}>()

const emit = defineEmits<{
  clearQueued: []
}>()

const { t, n } = useI18n()

const runningJobsLabel = computed(() =>
  t('sideToolbar.queueProgressOverlay.runningJobsLabel', {
    count: n(runningCount)
  })
)
</script>
