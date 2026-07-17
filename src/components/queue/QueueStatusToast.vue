<template>
  <ProcessToast
    v-if="hasActiveJob"
    data-testid="queue-status-toast"
    class="pointer-events-auto"
    :verb="t('g.running')"
    :percent="totalPercent"
    status="progress"
    :failed-count="failedCount"
    :expanded="expanded"
    hide-chevron
    progress-class="bg-base-foreground"
  >
    <template #action>
      <div
        class="mx-0.5 h-5 w-px shrink-0 self-center bg-interface-stroke"
        aria-hidden="true"
      />
      <Button
        v-tooltip.bottom="stopTooltip"
        variant="textonly"
        size="sm"
        class="gap-1 text-text-secondary"
        :aria-label="t('processToast.stop')"
        data-testid="queue-status-stop"
        @click="interruptAll"
      >
        <i class="icon-[lucide--square] size-4 shrink-0" />
        {{ t('processToast.stop') }}
      </Button>
      <Button
        v-tooltip.bottom="expandTooltip"
        variant="textonly"
        size="icon-sm"
        :aria-label="expanded ? t('processToast.collapse') : t('processToast.expand')"
        data-testid="queue-status-expand"
        @click="expanded = !expanded"
      >
        <i
          :class="
            cn(
              'size-3.5',
              expanded
                ? 'icon-[lucide--chevron-up]'
                : 'icon-[lucide--chevron-down]'
            )
          "
        />
      </Button>
    </template>

    <template #panel>
      <div
        data-testid="queue-status-panel"
        class="mt-1 flex w-80 flex-col overflow-clip rounded-lg bg-comfy-menu-bg shadow-interface"
      >
        <div class="flex h-10 shrink-0 items-center justify-between px-3">
          <span class="text-sm font-bold text-base-foreground">
            {{ t('queueStatus.activeGenerations') }}
          </span>
          <Button
            v-if="runningCount > 0"
            variant="textonly"
            size="sm"
            class="text-text-secondary"
            data-testid="queue-status-cancel-all"
            @click="interruptAll"
          >
            {{ t('queueStatus.cancelAll') }}
          </Button>
        </div>

        <div class="flex max-h-[50vh] flex-col gap-2 overflow-y-auto px-2 pb-2">
          <div
            v-for="job in activeJobs"
            :key="job.id"
            data-testid="queue-status-row"
            class="flex items-center justify-between gap-3 overflow-clip rounded-lg bg-secondary-background px-4 py-3"
          >
            <span class="truncate text-sm text-base-foreground">
              {{ job.title }}
            </span>
            <div class="flex shrink-0 items-center gap-2">
              <template v-if="isRunning(job)">
                <Loader
                  size="sm"
                  variant="loader-circle"
                  class="text-text-secondary"
                />
                <span class="text-xs tabular-nums text-base-foreground">
                  {{ jobPercent(job) }}%
                </span>
              </template>
              <span
                v-else-if="job.state === 'pending'"
                class="text-xs text-muted-foreground"
              >
                {{ t('queueStatus.pending') }}
              </span>
              <template v-else-if="job.state === 'failed'">
                <i
                  class="icon-[lucide--circle-alert] size-4 text-destructive-background"
                />
                <StatusBadge severity="danger" :label="t('queueStatus.failed')" />
              </template>
            </div>
          </div>

          <p
            v-if="!activeJobs.length"
            class="px-2 py-4 text-center text-xs text-muted-foreground"
          >
            {{ t('queueStatus.nothingRunning') }}
          </p>
        </div>
      </div>
    </template>
  </ProcessToast>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'

import ProcessToast from '@/components/common/ProcessToast.vue'
import StatusBadge from '@/components/common/StatusBadge.vue'
import Loader from '@/components/loader/Loader.vue'
import Button from '@/components/ui/button/Button.vue'
import { useJobList } from '@/composables/queue/useJobList'
import type { JobListItem } from '@/composables/queue/useJobList'
import { useQueueProgress } from '@/composables/queue/useQueueProgress'
import { useErrorHandling } from '@/composables/useErrorHandling'
import { buildTooltipConfig } from '@/composables/useTooltipConfig'
import { api } from '@/scripts/api'
import { useExecutionStore } from '@/stores/executionStore'
import { useQueueStore } from '@/stores/queueStore'
import { cn } from '@comfyorg/tailwind-utils'

const { t } = useI18n()
const queueStore = useQueueStore()
const executionStore = useExecutionStore()
const { wrapWithErrorHandlingAsync } = useErrorHandling()
const { totalPercent } = useQueueProgress()
const { jobItems } = useJobList()

const expanded = ref(false)

const runningCount = computed(() => queueStore.runningTasks.length)
const isExecuting = computed(() => !executionStore.isIdle)
const hasActiveJob = computed(() => runningCount.value > 0 || isExecuting.value)

const ACTIVE_STATES: ReadonlySet<JobListItem['state']> = new Set([
  'running',
  'initialization',
  'pending',
  'failed'
])
const activeJobs = computed(() =>
  jobItems.value.filter((job) => ACTIVE_STATES.has(job.state))
)
const failedCount = computed(
  () => activeJobs.value.filter((job) => job.state === 'failed').length
)

const isRunning = (job: JobListItem) =>
  job.state === 'running' || job.state === 'initialization'
const jobPercent = (job: JobListItem) =>
  Math.round(job.progressTotalPercent ?? 0)

const stopTooltip = computed(() =>
  buildTooltipConfig(t('sideToolbar.queueProgressOverlay.interruptAll'))
)
const expandTooltip = computed(() =>
  buildTooltipConfig(
    expanded.value ? t('processToast.collapse') : t('processToast.expand')
  )
)

const interruptAll = wrapWithErrorHandlingAsync(async () => {
  const jobIds = queueStore.runningTasks
    .map((task) => task.jobId)
    .filter((id): id is string => typeof id === 'string' && id.length > 0)

  if (!jobIds.length) return

  // State-agnostic batch cancel (see api.ts cancelJobs for the runtime-parity caveat).
  await api.cancelJobs(jobIds)
  executionStore.clearInitializationByJobIds(jobIds)
  await queueStore.update()
})
</script>
