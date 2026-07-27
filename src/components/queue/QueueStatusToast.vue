<template>
  <!-- Idle pill and status toast trade places. This swap is deliberately not a
       <Transition>: Vue drives one with requestAnimationFrame, which a
       background tab pauses, and a swap stuck mid-flight leaves a run with no
       visible status at all. A one-shot enter animation can't wedge. -->
  <div
    v-if="toastView"
    data-testid="queue-status-toast"
    class="pointer-events-auto flex animate-in flex-col items-end gap-1 fade-in-0 zoom-in-95 duration-200 motion-reduce:animate-none"
  >
    <!-- hide-chevron stays off: dropping the slab whenever the job list is
         momentarily empty would resize the pill mid-run. -->
    <ProcessToast
      :verb="toastView.verb"
      :percent="toastView.percent"
      :status="toastView.status"
      :failed-count="failedCount"
      :expanded="expanded"
      :hide-action="!toastView.showStop || (hasParallelRuns && expanded)"
      :show-percent-text="toastView.showPercentText"
      progress-class="bg-base-foreground"
      @toggle-expand="expanded = !expanded"
    >
      <template #action>
        <button
          v-tooltip.bottom="stopTooltip"
          type="button"
          class="flex size-4 shrink-0 cursor-pointer items-center justify-center border-none bg-transparent p-0 text-base-foreground opacity-90 transition-opacity hover:opacity-100"
          :aria-label="t('processToast.stop')"
          data-testid="queue-status-stop"
          @click="onStopClick"
        >
          <i class="icon-[comfy--stop] size-4" />
        </button>
      </template>
    </ProcessToast>

    <div
      v-if="expanded"
      data-testid="queue-status-panel"
      class="flex w-80 flex-col overflow-clip rounded-lg border border-solid border-charcoal-700 bg-comfy-menu-bg drop-shadow-[1px_1px_4px_rgba(0,0,0,0.4)]"
    >
      <div class="flex shrink-0 items-center justify-between py-3.5 pr-3 pl-4">
        <span class="text-[13px] font-semibold text-base-foreground">
          {{ t('queueStatus.activeGenerations') }}
        </span>
        <button
          v-if="activeJobs.length > 0"
          type="button"
          class="cursor-pointer border-none bg-transparent text-[11px] font-medium text-base-foreground"
          data-testid="queue-status-cancel-all"
          @click="cancelAll"
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
          class="relative flex flex-col gap-1 overflow-clip rounded-lg bg-secondary-background px-3 py-2"
        >
          <div class="flex items-center justify-between gap-2">
            <span
              class="min-w-0 flex-1 truncate text-sm font-normal text-base-foreground"
            >
              {{ job.title }}
            </span>
            <div class="flex shrink-0 items-center gap-2">
              <button
                v-tooltip.bottom="pauseTooltip"
                type="button"
                class="flex size-4 cursor-pointer items-center justify-center border-none bg-transparent p-0 text-text-secondary disabled:opacity-40"
                :aria-label="t('queueStatus.pause')"
                data-testid="queue-status-row-pause"
                disabled
              >
                <i class="icon-[comfy--pause] size-4" />
              </button>
              <button
                v-tooltip.bottom="cancelTooltip"
                type="button"
                class="flex size-4 cursor-pointer items-center justify-center border-none bg-transparent p-0 text-text-secondary"
                :aria-label="t('queueStatus.cancel')"
                data-testid="queue-status-row-cancel"
                @click="cancelJob(job)"
              >
                <i class="icon-[comfy--stop] size-4" />
              </button>
            </div>
          </div>

          <span class="truncate text-xs text-muted-foreground">
            {{ jobSubtitle(job) }}
          </span>

          <!-- Progress hugs the row's bottom edge, as it does on the pill -->
          <div
            v-if="isRunning(job)"
            class="absolute bottom-0 left-0 h-px rounded-[1px] bg-base-foreground transition-[width] duration-200 ease-out"
            :style="{ width: `${jobPercent(job)}%` }"
          />
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
  <div
    v-else
    class="flex animate-in fade-in-0 zoom-in-95 duration-200 motion-reduce:animate-none"
  >
    <Popover>
      <PopoverTrigger as-child>
        <!-- The chevron is what tells people this opens something; without it
             "0 active" reads as a bare status label, not a control. -->
        <button
          type="button"
          data-testid="queue-status-idle"
          class="group pointer-events-auto flex cursor-pointer items-center gap-1 rounded-lg border border-solid border-[#2d2e32] bg-[#232426] px-2 py-1 text-sm leading-5 text-base-foreground transition-colors hover:bg-[#2d2e32]"
        >
          {{ activeJobsLabel }}
          <i
            class="icon-[lucide--chevron-down] size-3.5 text-muted-foreground transition-transform duration-200 group-data-[state=open]:rotate-180"
          />
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        :side-offset="8"
        data-testid="queue-status-idle-panel"
        class="flex w-[326px] flex-col items-center gap-3 rounded-lg border-none bg-comfy-menu-bg py-3 shadow-none drop-shadow-[1px_1px_4px_rgba(0,0,0,0.4)]"
      >
        <!-- Idle is exactly when someone goes looking for what they just
             made, so recent runs are here rather than a tab away. Figma
             node 2640-40346. -->
        <div class="flex w-full flex-col gap-3 px-3">
          <div class="flex items-center justify-between">
            <span class="text-[13px] font-semibold text-base-foreground">
              {{ t('queueStatus.recentResults') }}
            </span>
            <button
              v-tooltip.bottom="viewHistoryTooltip"
              type="button"
              class="flex size-3.5 cursor-pointer items-center justify-center border-none bg-transparent p-0 text-muted-foreground transition-colors hover:text-base-foreground"
              :aria-label="t('queueStatus.goToHistory')"
              data-testid="queue-status-filter"
              @click="goToHistory"
            >
              <i class="icon-[lucide--list-filter] size-3.5" />
            </button>
          </div>

          <template v-if="recentJobs.length">
            <button
              v-for="job in recentJobs"
              :key="job.id"
              type="button"
              class="relative flex h-[52px] cursor-pointer items-center gap-2.5 overflow-clip rounded-[10px] border-none bg-[#1c1c1d] px-3 py-2 text-left transition-colors hover:bg-[#232426]"
              :aria-label="t('queueStatus.viewResult')"
              data-testid="queue-status-recent-job"
              @click="openRecentJob(job)"
            >
              <span class="flex min-w-0 flex-1 flex-col gap-1">
                <span class="truncate text-sm font-normal text-base-foreground">
                  {{ recentJobName(job) }}
                </span>
                <span class="truncate text-xs text-[#8a8a8a]">
                  {{ recentJobMeta(job) }}
                </span>
              </span>
              <!-- Thumbnail only when the run produced one; no empty tile. -->
              <span
                v-if="jobThumbnail(job)"
                class="relative flex size-[41px] shrink-0 items-center justify-center overflow-clip rounded-lg bg-comfy-menu-bg outline-1 outline-base-foreground/10"
              >
                <img
                  :src="jobThumbnail(job)!.previewUrl"
                  alt=""
                  loading="lazy"
                  class="size-full object-cover"
                />
                <i
                  v-if="jobThumbnail(job)?.isVideo"
                  class="icon-[lucide--play] absolute right-0.5 bottom-0.5 size-2.5 text-base-foreground drop-shadow-[0_1px_2px_rgba(0,0,0,0.6)]"
                />
              </span>
            </button>
          </template>
          <p v-else class="py-2 text-center text-xs text-muted-foreground">
            {{ t('queueStatus.nothingRunning') }}
          </p>
        </div>

        <div class="h-px w-full bg-base-foreground/10" />

        <div class="w-full px-3">
          <Button
            variant="secondary"
            size="unset"
            class="h-8 w-full gap-1.5 rounded-lg text-sm font-medium"
            data-testid="queue-status-go-history"
            @click="goToHistory"
          >
            <i class="icon-[lucide--history] size-4 shrink-0" />
            {{ t('queueStatus.goToHistory') }}
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  </div>

  <MediaLightbox
    v-model:active-index="galleryActiveIndex"
    :all-gallery-items="galleryItems"
  />
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
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
import type { ResultItemImpl, TaskItemImpl } from '@/stores/queueStore'
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
  showPercentText: boolean
  showStop: boolean
}

/**
 * Size of the burst the user submitted, held until the queue drains so the
 * pill can count "3/7" through it. Batches and parallel runs both land here.
 */
const batchTotal = ref(0)
const outstandingCount = computed(() => runningCount.value + pendingCount.value)
watch(outstandingCount, (outstanding) => {
  batchTotal.value =
    outstanding === 0 ? 0 : Math.max(batchTotal.value, outstanding)
})
const batchPosition = computed(() =>
  Math.min(batchTotal.value - outstandingCount.value + 1, batchTotal.value)
)

const initializingCount = computed(
  () => activeJobs.value.filter((job) => job.state === 'initialization').length
)

// Mirrors JobState: initialization and pending are distinct waits, and each
// state reuses the shared label the rest of the queue UI already shows.
const toastView = computed<ToastView | null>(() => {
  if (runningCount.value > 0 || isExecuting.value) {
    const isBatch = batchTotal.value > 1
    return {
      status: 'progress',
      verb: isBatch
        ? t('queueStatus.runningPosition', {
            position: batchPosition.value,
            total: batchTotal.value
          })
        : t('g.running'),
      percent: totalPercent.value,
      // The counter carries the batch story; a second number just competes.
      showPercentText: !isBatch,
      showStop: true
    }
  }
  if (initializingCount.value > 0) {
    return {
      status: 'progress',
      // The queue panel's "Initializing - Almost ready" is too long for a pill
      // that must hold one width across every state.
      verb: t('queueStatus.starting'),
      percent: null,
      showPercentText: false,
      showStop: false
    }
  }
  if (pendingCount.value > 0) {
    return {
      status: 'progress',
      verb:
        pendingCount.value > 1
          ? t('queueStatus.queuedCount', { count: pendingCount.value })
          : t('g.queued'),
      percent: null,
      showPercentText: false,
      // Only a job that is actually executing can be stopped.
      showStop: false
    }
  }
  const notification = currentNotification.value
  if (notification?.type === 'completed') {
    return {
      status: 'done',
      verb: t('g.completed'),
      percent: null,
      showPercentText: false,
      showStop: false
    }
  }
  if (notification?.type === 'failed') {
    return {
      status: 'failed',
      verb: t('g.failed'),
      percent: null,
      showPercentText: false,
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
/**
 * jobItems is newest-first; the panel reads as a timeline, so the most recent
 * run belongs at the bottom, next to the pill it came from.
 */
const activeJobs = computed(() =>
  jobItems.value.filter((job) => ACTIVE_STATES.has(job.state)).reverse()
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
const isRunning = (job: JobListItem) =>
  job.state === 'running' || job.state === 'initialization'
const jobPercent = (job: JobListItem) =>
  Math.round(job.progressTotalPercent ?? 0)
/** buildJobDisplay already derives per-state copy; don't re-invent it here. */
const jobSubtitle = (job: JobListItem) => job.meta

/**
 * With one run there is no ambiguity, so stop interrupts it. With several,
 * stopping "the run" would silently take them all down; open the panel instead
 * and let the choice be explicit.
 */
const hasParallelRuns = computed(() => runningCount.value > 1)
const onStopClick = () => {
  if (hasParallelRuns.value) {
    expanded.value = true
    return
  }
  void stopRunning()
}
const stopTooltip = computed(() =>
  buildTooltipConfig(
    hasParallelRuns.value
      ? t('queueStatus.chooseRunToStop')
      : t('sideToolbar.queueProgressOverlay.interruptAll')
  )
)
// No pause endpoint exists yet, so the control is present but inert.
const pauseTooltip = computed(() =>
  buildTooltipConfig(t('queueStatus.pauseUnavailable'))
)
const cancelTooltip = computed(() => buildTooltipConfig(t('queueStatus.cancel')))
const viewHistoryTooltip = computed(() =>
  buildTooltipConfig(t('queueStatus.goToHistory'))
)

const { galleryActiveIndex, galleryItems } = useResultGallery(() =>
  activeJobs.value
    .map((job) => job.taskRef)
    .filter((task): task is TaskItemImpl => !!task)
)

/**
 * Latest finished jobs, newest first. Surfaced on the idle popover because that
 * is the moment people go looking for what a run produced — user tests showed
 * they don't know the outputs land in the assets panel. Each row keeps the
 * job's name and finish time, not just a bare thumbnail.
 */
const RECENT_JOB_LIMIT = 4
const recentJobs = computed(() =>
  jobItems.value
    .filter((job) => job.state === 'completed')
    .slice(0, RECENT_JOB_LIMIT)
)

const jobThumbnail = (job: JobListItem): ResultItemImpl | undefined =>
  job.taskRef?.previewOutput

/** Prefer the output's name; fall back to the finish status when there is none. */
const recentJobName = (job: JobListItem): string =>
  jobThumbnail(job)?.filename || job.title
/** Avoid repeating the name: show finish status, or the precise time as backup. */
const recentJobMeta = (job: JobListItem): string =>
  jobThumbnail(job)?.filename ? job.title : job.meta

const openRecentJob = (job: JobListItem) => {
  const outputs = recentJobs.value
    .map((entry) => jobThumbnail(entry))
    .filter((output): output is ResultItemImpl => !!output)
  const index = outputs.findIndex(
    (output) => output.url === jobThumbnail(job)?.url
  )
  if (index < 0) return
  galleryItems.value = outputs
  galleryActiveIndex.value = index
}

/**
 * Cancelling leaves activeJobId pointing at a job the backend will never
 * report on, so the pill would keep claiming a run in progress. Reconcile it
 * against what the queue actually holds, the way a reconnect does.
 */
const reconcileActiveJob = () => {
  executionStore.clearActiveJobIfStale(
    new Set([
      ...queueStore.runningTasks.map((task) => task.jobId),
      ...queueStore.pendingTasks.map((task) => task.jobId)
    ])
  )
}

const cancelJob = wrapWithErrorHandlingAsync(async (job: JobListItem) => {
  const jobId = job.taskRef?.jobId
  if (!jobId) return
  await api.cancelJob(String(jobId))
  executionStore.clearInitializationByJobId(String(jobId))
  // Cancelled work leaves the batch; it was never done, so shrink the total
  // rather than letting the counter read it as progress.
  batchTotal.value = Math.max(0, batchTotal.value - 1)
  await queueStore.update()
  reconcileActiveJob()
})

const toJobIds = (tasks: TaskItemImpl[]) =>
  tasks
    .map((task) => task.jobId)
    .filter((id): id is string => typeof id === 'string' && id.length > 0)

const cancelJobIds = wrapWithErrorHandlingAsync(async (jobIds: string[]) => {
  if (!jobIds.length) return

  // State-agnostic batch cancel (see api.ts cancelJobs for the runtime-parity caveat).
  await api.cancelJobs(jobIds)
  executionStore.clearInitializationByJobIds(jobIds)
  batchTotal.value = Math.max(0, batchTotal.value - jobIds.length)
  await queueStore.update()
  reconcileActiveJob()
})

/**
 * The pill's stop interrupts what is executing and leaves the queue alone, so
 * whatever is next still starts. Clearing the queue is the panel's "Cancel all".
 */
const stopRunning = () => cancelJobIds(toJobIds(queueStore.runningTasks))
const cancelAll = () =>
  cancelJobIds(
    toJobIds([...queueStore.runningTasks, ...queueStore.pendingTasks])
  )
</script>
