<template>
  <div
    v-if="toastView"
    data-testid="queue-status-toast"
    class="pointer-events-auto flex flex-col items-end gap-1"
  >
    <ProcessToast
      :verb="toastView.verb"
      :percent="toastView.percent"
      :status="toastView.status"
      :failed-count="failedCount"
      :expanded="expanded"
      :hide-chevron="activeJobs.length === 0"
      progress-class="bg-base-foreground/90"
      @toggle-expand="expanded = !expanded"
    >
      <template #action>
        <template v-if="toastView.showStop">
          <div
            class="mx-0.5 h-7 w-px shrink-0 self-center bg-base-foreground/10"
            aria-hidden="true"
          />
          <button
            v-tooltip.bottom="stopTooltip"
            type="button"
            class="flex cursor-pointer items-center justify-center border-none bg-transparent px-1 text-base-foreground opacity-90 transition-opacity hover:opacity-100"
            :aria-label="t('processToast.stop')"
            data-testid="queue-status-stop"
            @click="interruptAll"
          >
            <span
              class="size-[11px] shrink-0 rounded-[2px] bg-base-foreground"
              aria-hidden="true"
            />
          </button>
        </template>
      </template>
    </ProcessToast>

    <div
      v-if="expanded"
      data-testid="queue-status-panel"
      class="flex w-80 flex-col overflow-clip rounded-lg bg-comfy-menu-bg drop-shadow-[1px_1px_4px_rgba(0,0,0,0.4)]"
    >
      <div class="flex shrink-0 items-center justify-between py-3.5 pr-3 pl-4">
        <span class="text-[13px] font-semibold text-base-foreground">
          {{ t('queueStatus.activeGenerations') }}
        </span>
        <button
          v-if="hasRunningJob"
          type="button"
          class="cursor-pointer border-none bg-transparent text-[11px] font-medium text-base-foreground"
          data-testid="queue-status-cancel-all"
          @click="interruptAll"
        >
          {{ t('queueStatus.cancelAll') }}
        </button>
      </div>

      <div
        class="flex max-h-[50vh] flex-col gap-1.5 overflow-y-auto px-[9px] pb-[9px]"
      >
        <div
          v-for="job in activeJobs"
          :key="job.id"
          data-testid="queue-status-row"
          class="flex flex-col gap-1.5 rounded-[10px] bg-secondary-background p-2.5"
        >
          <div class="flex items-start justify-between gap-2">
            <div class="flex min-w-0 flex-1 flex-col gap-1.5">
              <span
                class="truncate text-[12.5px] leading-none font-medium text-base-foreground"
              >
                {{ job.title }}
              </span>
              <span class="truncate text-[11px] leading-none text-[#8a8a8a]">
                {{ jobSubtitle(job) }}
              </span>
            </div>
            <div class="flex shrink-0 items-center gap-4">
              <button
                v-tooltip.bottom="locateTooltip"
                type="button"
                class="flex size-3.5 cursor-pointer items-center justify-center border-none bg-transparent p-0 text-text-secondary"
                :aria-label="t('queueStatus.locate')"
                data-testid="queue-status-row-view"
                @click="viewJob(job)"
              >
                <i class="icon-[lucide--locate] size-3.5" />
              </button>
              <button
                v-tooltip.bottom="cancelTooltip"
                type="button"
                class="flex size-3.5 cursor-pointer items-center justify-center border-none bg-transparent p-0 text-text-secondary"
                :aria-label="t('queueStatus.cancel')"
                data-testid="queue-status-row-cancel"
                @click="cancelJob(job)"
              >
                <i class="icon-[lucide--x] size-3.5" />
              </button>
            </div>
          </div>

          <div
            v-if="isRunning(job)"
            class="mt-1 h-1 w-full overflow-hidden rounded-[2px] bg-base-foreground/10"
          >
            <div
              class="h-full rounded-[2px] bg-base-foreground/90 transition-[width] duration-200 ease-out"
              :style="{ width: `${jobPercent(job)}%` }"
            />
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
  </div>

  <!-- Idle: nothing queued, running or recently finished -->
  <Popover v-else>
    <PopoverTrigger as-child>
      <button
        type="button"
        data-testid="queue-status-idle"
        class="pointer-events-auto flex h-6 cursor-pointer items-center rounded-md border border-solid border-base-foreground/40 bg-transparent px-2 text-xs text-base-foreground opacity-50 transition-opacity hover:opacity-70 data-[state=open]:opacity-100"
      >
        {{ activeJobsLabel }}
      </button>
    </PopoverTrigger>
    <PopoverContent
      align="end"
      :side-offset="6"
      data-testid="queue-status-idle-panel"
      class="flex w-56 flex-col gap-3 p-3"
    >
      <p class="text-center text-xs text-muted-foreground">
        {{ t('queueStatus.nothingRunning') }}
      </p>
      <Button
        variant="secondary"
        size="sm"
        class="w-full gap-2"
        data-testid="queue-status-go-history"
        @click="goToHistory"
      >
        <i class="icon-[lucide--history] size-4 shrink-0" />
        {{ t('queueStatus.goToHistory') }}
      </Button>
    </PopoverContent>
  </Popover>

  <MediaLightbox
    v-model:active-index="galleryActiveIndex"
    :all-gallery-items="galleryItems"
  />
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'

import { PopoverTrigger } from 'reka-ui'

import ProcessToast from '@/components/common/ProcessToast.vue'
import MediaLightbox from '@/components/sidebar/tabs/queue/MediaLightbox.vue'
import Button from '@/components/ui/button/Button.vue'
import Popover from '@/components/ui/popover/Popover.vue'
import PopoverContent from '@/components/ui/popover/PopoverContent.vue'
import { useJobList } from '@/composables/queue/useJobList'
import type { JobListItem } from '@/composables/queue/useJobList'
import { useQueueNotificationBanners } from '@/composables/queue/useQueueNotificationBanners'
import { useQueueProgress } from '@/composables/queue/useQueueProgress'
import { useResultGallery } from '@/composables/queue/useResultGallery'
import { useErrorHandling } from '@/composables/useErrorHandling'
import { buildTooltipConfig } from '@/composables/useTooltipConfig'
import { api } from '@/scripts/api'
import { useExecutionStore } from '@/stores/executionStore'
import type { TaskItemImpl } from '@/stores/queueStore'
import { useQueueStore } from '@/stores/queueStore'
import { useSidebarTabStore } from '@/stores/workspace/sidebarTabStore'

const { t, n } = useI18n()
const queueStore = useQueueStore()
const executionStore = useExecutionStore()
const { wrapWithErrorHandlingAsync } = useErrorHandling()
const { totalPercent } = useQueueProgress()
const { jobItems } = useJobList()

const sidebarTabStore = useSidebarTabStore()

const expanded = ref(false)

/** Idle popover shortcut into the job history. */
const goToHistory = () => {
  sidebarTabStore.toggleSidebarTab('job-history')
}

const runningCount = computed(() => queueStore.runningTasks.length)
const pendingCount = computed(() => queueStore.pendingTasks.length)
const isExecuting = computed(() => !executionStore.isIdle)

/**
 * Single surface for the whole job lifecycle: queued → running →
 * completed/failed. Replaces the transient queue notification banners, reusing
 * their completion/failure signal.
 */
const { currentNotification } = useQueueNotificationBanners()

type ToastView = {
  status: 'progress' | 'done' | 'failed'
  verb: string
  percent: number | null
  showStop: boolean
}

const toastView = computed<ToastView | null>(() => {
  if (runningCount.value > 0 || isExecuting.value) {
    return {
      status: 'progress',
      verb: t('g.running'),
      percent: totalPercent.value,
      showStop: true
    }
  }
  if (pendingCount.value > 0) {
    return {
      status: 'progress',
      verb:
        pendingCount.value > 1
          ? t('queueStatus.queuedCount', { count: pendingCount.value })
          : t('queueStatus.queued'),
      percent: null,
      // Only a job that is actually executing can be stopped.
      showStop: false
    }
  }
  const notification = currentNotification.value
  if (notification?.type === 'completed') {
    return {
      status: 'done',
      verb: t('queueStatus.completed'),
      percent: null,
      showStop: false
    }
  }
  if (notification?.type === 'failed') {
    return {
      status: 'failed',
      verb: t('queueStatus.jobFailed'),
      percent: null,
      showStop: false
    }
  }
  return null
})

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

/** Idle label, e.g. "0 active". */
const activeJobsLabel = computed(() => {
  const count = queueStore.activeJobsCount
  return t(
    'sideToolbar.queueProgressOverlay.activeJobsShort',
    { count: n(count) },
    count
  )
})
const hasRunningJob = computed(() => activeJobs.value.some(isRunning))

const isRunning = (job: JobListItem) =>
  job.state === 'running' || job.state === 'initialization'
const jobPercent = (job: JobListItem) =>
  Math.round(job.progressTotalPercent ?? 0)
const jobSubtitle = (job: JobListItem) => {
  if (isRunning(job)) return `${t('g.running')} · ${jobPercent(job)}%`
  if (job.state === 'failed') return t('queueStatus.jobFailed')
  return t('queueStatus.queued')
}

const stopTooltip = computed(() =>
  buildTooltipConfig(t('sideToolbar.queueProgressOverlay.interruptAll'))
)
const locateTooltip = computed(() =>
  buildTooltipConfig(t('queueStatus.locate'))
)
const cancelTooltip = computed(() => buildTooltipConfig(t('queueStatus.cancel')))

const { galleryActiveIndex, galleryItems, onViewItem } = useResultGallery(() =>
  activeJobs.value
    .map((job) => job.taskRef)
    .filter((task): task is TaskItemImpl => !!task)
)

const viewJob = (job: JobListItem) => {
  void onViewItem(job)
}

const cancelJob = wrapWithErrorHandlingAsync(async (job: JobListItem) => {
  const jobId = job.taskRef?.jobId
  if (!jobId) return
  await api.cancelJob(String(jobId))
  executionStore.clearInitializationByJobId(String(jobId))
  await queueStore.update()
})

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
