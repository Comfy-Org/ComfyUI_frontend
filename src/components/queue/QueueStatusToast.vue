<template>
  <div
    v-if="toastView"
    data-testid="queue-status-toast"
    class="pointer-events-auto flex flex-col items-end gap-1"
  >
    <!-- Status pill + expand tab, sharing one surface -->
    <div
      class="flex items-center gap-1 rounded-xl bg-comfy-menu-bg p-2 shadow-interface"
    >
      <ProcessToast
        :verb="toastView.verb"
        :percent="toastView.percent"
        :status="toastView.status"
        :failed-count="failedCount"
        hide-chevron
        progress-class="bg-base-foreground"
        pill-class="rounded-md bg-secondary-background shadow-none"
      >
        <template #action>
          <template v-if="toastView.showStop">
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
              <i class="icon-[comfy--stop] size-4 shrink-0" />
              {{ t('processToast.stop') }}
            </Button>
          </template>
        </template>
      </ProcessToast>

      <Button
        v-if="activeJobs.length > 0"
        v-tooltip.bottom="expandTooltip"
        variant="textonly"
        size="icon-sm"
        :aria-label="
          expanded ? t('processToast.collapse') : t('processToast.expand')
        "
        data-testid="queue-status-expand"
        @click="expanded = !expanded"
      >
        <i
          :class="
            cn(
              'size-4',
              expanded
                ? 'icon-[lucide--chevron-up]'
                : 'icon-[lucide--chevron-down]'
            )
          "
        />
      </Button>
    </div>

    <div
      v-if="expanded"
      data-testid="queue-status-panel"
      class="flex w-80 flex-col overflow-clip rounded-lg bg-comfy-menu-bg shadow-interface"
    >
        <div class="flex h-10 shrink-0 items-center justify-between px-3">
          <span class="text-sm font-bold text-base-foreground">
            {{ t('queueStatus.activeGenerations') }}
          </span>
          <Button
            v-if="hasRunningJob"
            variant="textonly"
            size="sm"
            class="font-medium text-base-foreground"
            data-testid="queue-status-cancel-all"
            @click="interruptAll"
          >
            {{ t('queueStatus.cancelAll') }}
          </Button>
        </div>

        <div class="flex max-h-[50vh] flex-col gap-1.5 overflow-y-auto px-2 pb-2">
          <div
            v-for="job in activeJobs"
            :key="job.id"
            data-testid="queue-status-row"
            class="flex flex-col gap-1 rounded-lg bg-secondary-background px-3 py-2"
          >
            <div class="flex items-center justify-between gap-2">
              <span
                class="min-w-0 flex-1 truncate text-xs font-medium text-base-foreground"
              >
                {{ job.title }}
              </span>
              <div class="-my-1 flex shrink-0 items-center gap-0.5">
                <Button
                  v-tooltip.bottom="locateTooltip"
                  variant="textonly"
                  size="icon-sm"
                  :aria-label="t('queueStatus.locate')"
                  data-testid="queue-status-row-view"
                  @click="viewJob(job)"
                >
                  <i class="icon-[lucide--locate] size-3.5 text-text-secondary" />
                </Button>
                <Button
                  v-tooltip.bottom="cancelTooltip"
                  variant="textonly"
                  size="icon-sm"
                  :aria-label="t('queueStatus.cancel')"
                  data-testid="queue-status-row-cancel"
                  @click="cancelJob(job)"
                >
                  <i class="icon-[lucide--x] size-3.5 text-text-secondary" />
                </Button>
              </div>
            </div>

            <span class="text-[11px] leading-none text-muted-foreground">
              {{ jobSubtitle(job) }}
            </span>

            <div
              v-if="isRunning(job)"
              class="mt-0.5 h-1 w-full overflow-hidden rounded-full bg-white/10"
            >
              <div
                class="h-full rounded-full bg-base-foreground transition-[width] duration-200 ease-out"
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
        class="pointer-events-auto flex h-6 cursor-pointer items-center rounded-md border border-solid border-base-foreground bg-transparent px-2 text-xs text-base-foreground opacity-50 transition-opacity hover:opacity-70 data-[state=open]:opacity-100"
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
import { cn } from '@comfyorg/tailwind-utils'

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
      showStop: true
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
const expandTooltip = computed(() =>
  buildTooltipConfig(
    expanded.value ? t('processToast.collapse') : t('processToast.expand')
  )
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
