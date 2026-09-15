<template>
  <div class="relative inline-flex flex-col items-end">
    <!-- ================= Active / terminal toast ================= -->
    <div
      v-if="showToast"
      class="pointer-events-auto flex flex-col items-end gap-1"
      @pointerenter="openStack"
      @pointerleave="scheduleCloseStack"
    >
      <!-- One pill, one surface: the stop and the chevron live inside it,
           and the deck behind only peeks out below. -->
      <div class="relative isolate flex items-center">
        <!-- Stacked cards peeking under the pill, Sonner-style -->
        <template v-if="stackCount > 0 && !isTerminal && !fanned">
          <span
            v-for="depth in stackCount"
            :key="depth"
            :class="
              cn(
                'pointer-events-none absolute inset-x-0 top-0 h-9 rounded-[10px] border border-base-foreground/9 bg-base-background/75 backdrop-blur-xl transition-all duration-200 ease-out',
                depth === 1
                  ? 'z-1 translate-y-[6px] scale-[0.97] opacity-90'
                  : 'z-0 translate-y-[12px] scale-[0.94] opacity-70'
              )
            "
            aria-hidden
          />
        </template>

        <button
          type="button"
          :aria-expanded="isTerminal ? undefined : expanded"
          :aria-label="
            isTerminal
              ? terminalKind === 'completed'
                ? t('queueStatus.viewResults')
                : undefined
              : t('queueStatus.activeGenerations')
          "
          data-testid="queue-status-toast"
          :class="
            cn(
              'relative z-2 flex h-9 cursor-pointer items-stretch overflow-hidden rounded-[10px] border border-base-foreground/9 bg-base-background/80 p-0 text-left shadow-[0_4px_16px_rgba(0,0,0,0.3)] backdrop-blur-xl transition-colors hover:bg-secondary-background/80',
              isTerminal ? 'items-center px-3' : 'min-w-[176px]'
            )
          "
          @click="isTerminal ? onCompletedChipClick() : (expanded = !expanded)"
        >
          <!-- The chip: status, verb, and the stop that belongs to it. -->
          <div
            :class="
              cn(
                'relative flex min-w-0 flex-1 items-center gap-2',
                !isTerminal && 'pr-2 pl-2.5'
              )
            "
          >
            <span
              class="relative flex size-4 shrink-0 items-center justify-center"
            >
              <span
                v-if="!isTerminal"
                class="inline-block size-[15px] animate-spin rounded-full border-2 border-base-foreground/20 border-t-base-foreground/80"
                aria-hidden
              />
              <i
                v-else-if="terminalKind === 'failed'"
                class="icon-[lucide--circle-alert] size-4 text-destructive-background"
                aria-hidden
              />
              <i
                v-else-if="terminalKind === 'cancelled'"
                class="icon-[lucide--circle-slash] size-4 text-muted-foreground"
                aria-hidden
              />
              <!-- A bare check: the badge already frames it. -->
              <i
                v-else
                class="icon-[lucide--check] size-4 text-base-foreground"
                aria-hidden
              />
            </span>

            <span
              class="truncate text-[13.5px] leading-none font-normal whitespace-nowrap text-base-foreground tabular-nums"
            >
              {{ pillLabel }}
            </span>

            <span
              v-if="queuedBadge"
              class="shrink-0 rounded-full bg-white/8 px-1.5 py-1 text-[10px] leading-none font-medium tracking-wide text-muted-foreground uppercase"
            >
              {{ queuedBadge }}
            </span>

            <!-- Progress hugs the chip's bottom edge, as in the spec. -->
            <div
              v-if="showProgressLine"
              class="pointer-events-none absolute bottom-0 left-0 h-px bg-base-foreground/70 transition-[width] duration-200 ease-out"
              :style="{ width: `${headlineProgress}%` }"
              aria-hidden
            />
          </div>
        </button>
      </div>

      <!-- Expanding does not open a panel: the toasts behind the pill simply
           become visible, each one its own card, the way a Sonner stack
           unfurls. With runs in parallel every one keeps its own percent.
           The 8px breathing room is PADDING, not a gap, so the hover region
           runs continuously from the pill into the cards. -->
      <div
        v-if="expanded || fanned"
        class="absolute top-full right-0 z-50 -mr-2 flex w-80 flex-col items-end gap-2 px-2 pt-2 pb-3"
        data-testid="queue-status-panel"
      >
        <div
          v-for="(job, index) in jobs"
          :key="job.id"
          class="job-toast-row relative w-full overflow-hidden rounded-[10px] border border-base-foreground/9 bg-base-background/75 px-3 py-2 shadow-[0_4px_16px_rgba(0,0,0,0.3)] backdrop-blur-xl transition-colors hover:bg-secondary-background/80"
          :style="{ '--row-delay': `${index * 45}ms` }"
          data-testid="queue-status-row"
        >
          <div class="flex items-center gap-2">
            <span class="flex size-4 shrink-0 items-center justify-center">
              <span
                v-if="job.status === 'running'"
                :class="
                  cn(
                    'inline-block size-[13px] rounded-full border-2 border-base-foreground/20 border-t-base-foreground/80',
                    'animate-spin'
                  )
                "
                aria-hidden
              />
              <span
                v-else
                class="size-1.5 rounded-full bg-muted-foreground"
                aria-hidden
              />
            </span>

            <div class="flex min-w-0 flex-1 flex-col gap-0.5">
              <span
                class="truncate text-[13px] leading-none text-base-foreground"
              >
                {{ job.title }}
              </span>
              <span
                class="truncate text-[11px] leading-none text-muted-foreground"
              >
                {{ jobSubtitle(job) }}
              </span>
            </div>

            <div class="flex shrink-0 items-center gap-0.5">
              <button
                type="button"
                class="flex size-6 cursor-pointer items-center justify-center rounded-[6px] border-none bg-transparent p-0 text-muted-foreground transition-colors hover:bg-base-foreground/8 hover:text-base-foreground"
                :aria-label="`${t('queueStatus.cancel')} ${job.title}`"
                data-testid="queue-status-row-cancel"
                @click="handleCancel(job)"
              >
                <span class="size-3 rounded-[2px] bg-current" aria-hidden />
              </button>
            </div>
          </div>

          <!-- Progress hugs the toast's bottom edge, as it does on the pill -->
          <div
            v-if="job.status === 'running'"
            :class="
              cn(
                'pointer-events-none absolute bottom-0 left-0 h-px transition-[width] duration-200 ease-out',
                'bg-base-foreground/70'
              )
            "
            :style="{ width: `${job.progress}%` }"
            aria-hidden
          />
        </div>

        <!-- Batch verbs live at the foot of the stack, together. Each names its
             own scope: pause the running work, drop what hasn't started, or
             cancel everything. -->
        <div
          v-if="jobs.length > 1"
          class="job-toast-row flex items-center gap-0.5 rounded-[10px] border border-base-foreground/10 bg-base-background/60 p-1 shadow-[0_2px_12px_rgba(0,0,0,0.25)] backdrop-blur-2xl"
          :style="{ '--row-delay': `${jobs.length * 45}ms` }"
        >
          <button
            v-if="queuedCount > 0"
            type="button"
            class="flex cursor-pointer items-center gap-1.5 rounded-[7px] border-none bg-transparent px-2 py-1.5 text-[11.5px] font-medium text-muted-foreground transition-colors hover:bg-base-foreground/8 hover:text-base-foreground"
            data-testid="queue-status-clear-queue"
            @click="handleClearQueue"
          >
            <i class="icon-[lucide--eraser] size-3" aria-hidden />
            {{ t('queueStatus.clearQueue') }}
          </button>
          <button
            type="button"
            class="flex cursor-pointer items-center gap-1.5 rounded-[7px] border-none bg-transparent px-2 py-1.5 text-[11.5px] font-medium text-muted-foreground transition-colors hover:bg-base-foreground/8 hover:text-destructive-background"
            data-testid="queue-status-cancel-all"
            @click="handleCancelAll"
          >
            <span class="size-3 rounded-[2px] bg-current" aria-hidden />
            {{ t('queueStatus.cancelAll') }}
          </button>
        </div>
      </div>
    </div>

    <!-- ================= Idle: nothing queued or running ================= -->
    <Popover v-else v-model:open="idleOpen">
      <PopoverTrigger as-child>
        <!-- The chevron is what tells people this opens something; without it
             "0 active" reads as a bare status label, not a control. -->
        <button
          type="button"
          data-testid="queue-status-idle"
          :aria-label="t('queueStatus.nothingRunning')"
          :aria-expanded="idleOpen"
          class="group pointer-events-auto flex cursor-pointer items-center gap-1 rounded-lg border border-solid border-base-foreground/9 bg-transparent px-2 py-1 text-sm/5 text-base-foreground transition-colors hover:bg-secondary-background data-[state=open]:bg-secondary-background"
        >
          {{ activeJobsLabel }}
          <i
            class="icon-[lucide--chevron-down] size-3.5 text-muted-foreground transition-transform duration-200 group-data-[state=open]:rotate-180"
            aria-hidden
          />
        </button>
      </PopoverTrigger>
      <!-- Same material as a toast card: identical width, border, surface and
           shadow, so idle and active read as one family. -->
      <PopoverContent
        align="end"
        side="bottom"
        :side-offset="8"
        data-testid="queue-status-idle-panel"
        class="flex w-80 flex-col gap-2 rounded-[10px] border border-base-foreground/9 bg-base-background/80 p-2 shadow-[0_4px_18px_rgba(0,0,0,0.3)] backdrop-blur-xl"
      >
        <!-- Idle is exactly when someone goes looking for what they just
             made, so recent runs live here rather than a tab away. -->
        <div class="flex w-full flex-col gap-1">
          <div class="flex items-center justify-between px-1.5 pt-0.5 pb-1">
            <span
              class="text-[11px] font-medium tracking-wide text-muted-foreground uppercase"
            >
              {{ t('queueStatus.recentResults') }}
            </span>
            <button
              type="button"
              class="flex size-3.5 cursor-pointer items-center justify-center border-none bg-transparent p-0 text-muted-foreground transition-colors hover:text-base-foreground"
              :aria-label="t('queueStatus.goToHistoryShort')"
              data-testid="queue-status-filter"
              @click="handleGoToHistory"
            >
              <i class="icon-[lucide--list-filter] size-3.5" aria-hidden />
            </button>
          </div>

          <template v-if="recentResults.length">
            <button
              v-for="result in recentResults"
              :key="result.id"
              type="button"
              class="relative flex cursor-pointer items-center gap-2.5 overflow-hidden rounded-[8px] border-none bg-transparent px-1.5 py-2 text-left transition-colors hover:bg-secondary-background"
              :aria-label="t('queueStatus.viewResult')"
              data-testid="queue-status-recent-job"
              @click="handleViewResult(result.job)"
            >
              <!-- Thumbnail leads, as it does in the jobs panel and on the
                   toasts: one place for the picture, everywhere. -->
              <span
                v-if="result.thumbSrc"
                class="relative flex size-9 shrink-0 items-center justify-center overflow-hidden rounded-[6px] bg-base-background outline-1 outline-white/10"
              >
                <img
                  :src="result.thumbSrc"
                  alt=""
                  loading="lazy"
                  class="size-full object-cover"
                />
                <i
                  v-if="result.isVideo"
                  class="absolute right-0.5 bottom-0.5 icon-[lucide--play] size-2.5 text-base-foreground drop-shadow-[0_1px_2px_rgba(0,0,0,0.6)]"
                  aria-hidden
                />
              </span>
              <span class="flex min-w-0 flex-1 flex-col gap-0.5">
                <span
                  class="truncate text-[13px] leading-none text-base-foreground"
                >
                  {{ result.name }}
                </span>
                <span
                  class="truncate text-[11px] leading-none text-muted-foreground"
                >
                  {{ result.meta }}
                </span>
              </span>
            </button>
          </template>
          <p
            v-else
            class="px-1.5 py-3 text-center text-[11.5px] text-muted-foreground"
          >
            {{ t('queueStatus.nothingRunning') }}
          </p>
        </div>

        <!-- Same quiet verb treatment as the stack's footer actions. -->
        <div
          class="flex w-full items-center justify-end border-t border-base-foreground/6 pt-1.5"
        >
          <button
            type="button"
            class="flex cursor-pointer items-center gap-1.5 rounded-[7px] border-none bg-transparent px-2 py-1.5 text-[11.5px] font-medium text-muted-foreground transition-colors hover:bg-base-foreground/6 hover:text-base-foreground"
            data-testid="queue-status-go-history"
            @click="handleGoToHistory"
          >
            <i class="icon-[lucide--history] size-3" aria-hidden />
            {{ t('queueStatus.goToHistoryShort') }}
          </button>
        </div>
      </PopoverContent>
    </Popover>

    <MediaLightbox
      v-model:active-index="galleryActiveIndex"
      :all-gallery-items="galleryItems"
    />
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, onUnmounted, reactive, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'

import { PopoverTrigger } from 'reka-ui'

import MediaLightbox from '@/components/sidebar/tabs/queue/MediaLightbox.vue'
import Popover from '@/components/ui/popover/Popover.vue'
import PopoverContent from '@/components/ui/popover/PopoverContent.vue'
import { useJobList } from '@/composables/queue/useJobList'
import type { JobListItem } from '@/composables/queue/useJobList'
import { useResultGallery } from '@/composables/queue/useResultGallery'
import { useErrorHandling } from '@/composables/useErrorHandling'
import { api } from '@/scripts/api'
import { useExecutionStore } from '@/stores/executionStore'
import type { TaskItemImpl } from '@/stores/queueStore'
import type { AugmentedResultItem } from '@/utils/resultItem'
import { isVideoResult } from '@/utils/resultItem'
import { useQueueStore } from '@/stores/queueStore'
import { useRightSidePanelStore } from '@/stores/workspace/rightSidePanelStore'
import { cn } from '@comfyorg/tailwind-utils'

type JobView = {
  id: string
  title: string
  status: 'running' | 'queued'
  progress: number
  queuePosition: number
}

/** How long the terminal "Completed"/"Cancelled" chip lingers before idle returns. */
const COMPLETED_FLASH_MS = 3000
const RECENT_JOB_LIMIT = 4
/** First completion of the session auto-opens the recents popover, once. */
let popoverAutoOpened = false
const JOB_POPOVER_AUTO_OPEN_MS = 4000

const { t, n, locale } = useI18n()
const queueStore = useQueueStore()
const executionStore = useExecutionStore()
const { wrapWithErrorHandlingAsync } = useErrorHandling()
const { jobItems } = useJobList()
const rightSidePanelStore = useRightSidePanelStore()

const expanded = ref(false)
const idleOpen = ref(false)
let autoOpenTimer: number | undefined
let completedTimer: number | undefined

const ACTIVE_STATES: ReadonlySet<JobListItem['state']> = new Set([
  'running',
  'initialization',
  'pending'
])
const activeJobs = computed(() =>
  jobItems.value.filter((job) => ACTIVE_STATES.has(job.state)).reverse()
)
watch(
  activeJobs,
  (current) => {
    if (current.length > 0) lastActiveIds = current.map((job) => job.id)
  },
  { immediate: true }
)
const isRunningState = (state: JobListItem['state']) =>
  state === 'running' || state === 'initialization'

const liveJobs = computed<JobView[]>(() => {
  const running = activeJobs.value.filter((job) => isRunningState(job.state))
  const queued = activeJobs.value.filter((job) => job.state === 'pending')
  return [
    ...running.map((job) => ({
      id: job.id,
      title: job.title,
      status: 'running' as const,
      progress: Math.round(job.progressTotalPercent ?? 0),
      queuePosition: 0
    })),
    ...queued.map((job, index) => ({
      id: job.id,
      title: job.title,
      status: 'queued' as const,
      progress: 0,
      queuePosition: index + 1
    }))
  ]
})

const jobs = computed<JobView[]>(() => liveJobs.value)

const runningJobs = computed(() =>
  jobs.value.filter((job) => job.status === 'running')
)
const runningCount = computed(() => runningJobs.value.length)
const queuedJobs = computed(() =>
  jobs.value.filter((job) => job.status === 'queued')
)
const queuedCount = computed(() => queuedJobs.value.length)
const activeCount = computed(() => jobs.value.length)

const completedFlash = ref(false)
const terminalKind = ref<'completed' | 'cancelled' | 'failed'>('completed')
const cancelIntent = ref(false)
/** Active on the last tick, so the drain is judged by how each job ended. */
let lastActiveIds: string[] = []

const outcomeOf = (ids: string[]): typeof terminalKind.value => {
  // JobState folds Cancelled into failed, so read the task's display status.
  const outcomes = jobItems.value
    .filter((job) => ids.includes(job.id))
    .map((job) => job.taskRef?.displayStatus)
  if (outcomes.some((status) => status === 'Failed')) return 'failed'
  if (cancelIntent.value || outcomes.some((status) => status === 'Cancelled'))
    return 'cancelled'
  return 'completed'
}

watch(activeCount, (count, prev) => {
  if (count === 0 && (prev ?? 0) > 0) {
    terminalKind.value = outcomeOf(lastActiveIds)
    cancelIntent.value = false
    completedFlash.value = true
    expanded.value = false
    if (completedTimer !== undefined) window.clearTimeout(completedTimer)
    completedTimer = window.setTimeout(() => {
      completedTimer = undefined
      completedFlash.value = false
      if (terminalKind.value === 'completed') void maybeAutoOpenRecents()
    }, COMPLETED_FLASH_MS)
  } else if (count > 0) {
    completedFlash.value = false
    cancelIntent.value = false
    if (completedTimer !== undefined) {
      window.clearTimeout(completedTimer)
      completedTimer = undefined
    }
  }
})

async function maybeAutoOpenRecents() {
  if (popoverAutoOpened) return
  popoverAutoOpened = true
  await nextTick()
  idleOpen.value = true
  if (autoOpenTimer !== undefined) window.clearTimeout(autoOpenTimer)
  autoOpenTimer = window.setTimeout(() => {
    autoOpenTimer = undefined
    idleOpen.value = false
  }, JOB_POPOVER_AUTO_OPEN_MS)
}

const showToast = computed(() => activeCount.value > 0 || completedFlash.value)
const isTerminal = computed(
  () => completedFlash.value && activeCount.value === 0
)

const hovered = ref(false)
const HOVER_CLOSE_GRACE_MS = 320
let hoverCloseTimer: number | undefined

function openStack() {
  if (hoverCloseTimer !== undefined) {
    window.clearTimeout(hoverCloseTimer)
    hoverCloseTimer = undefined
  }
  hovered.value = true
}
function scheduleCloseStack() {
  if (hoverCloseTimer !== undefined) window.clearTimeout(hoverCloseTimer)
  hoverCloseTimer = window.setTimeout(() => {
    hoverCloseTimer = undefined
    hovered.value = false
  }, HOVER_CLOSE_GRACE_MS)
}

const stackCount = computed(() => Math.min(activeCount.value - 1, 2))
const fanned = computed(
  () => !isTerminal.value && (hovered.value || expanded.value)
)

const headlineProgress = computed(() => runningJobs.value[0]?.progress ?? 0)

const pillLabel = computed(() => {
  if (isTerminal.value) {
    if (terminalKind.value === 'failed') return t('queueStatus.failed')
    return terminalKind.value === 'cancelled'
      ? t('queueStatus.cancelled')
      : t('queueStatus.completed')
  }
  if (runningCount.value > 1)
    return t('queueStatus.processingCount', { count: runningCount.value })
  if (runningCount.value === 1)
    return queuedCount.value > 0
      ? t('queueStatus.running')
      : t('queueStatus.processing')
  return t('g.queued')
})

const queuedBadge = computed(() =>
  !isTerminal.value && runningCount.value > 0 && queuedCount.value > 0
    ? t('queueStatus.queuedBadge', { count: queuedCount.value })
    : null
)

const showProgressLine = computed(
  () => runningCount.value === 1 && !isTerminal.value
)

const activeJobsLabel = computed(() => {
  const count = queueStore.activeJobsCount
  return t(
    'sideToolbar.queueProgressOverlay.activeJobsShort',
    { count: n(count) },
    count
  )
})

const startedLabels = reactive<Record<string, string>>({})
watch(
  () => jobs.value.map((job) => job.id),
  (ids) => {
    for (const id of ids) {
      if (!startedLabels[id]) {
        startedLabels[id] = new Date().toLocaleTimeString(locale.value)
      }
    }
  },
  { immediate: true }
)
function jobSubtitle(job: JobView): string {
  if (job.status === 'running') {
    const started = startedLabels[job.id]
    const percent = `${job.progress}%`
    return started ? `${started} · ${percent}` : percent
  }
  return job.queuePosition === 1
    ? t('queueStatus.queuedNextUp')
    : t('queueStatus.queuedPosition', { position: job.queuePosition })
}

/** After a cancel, activeJobId can point at a job the backend never reports. */
const reconcileActiveJob = () => {
  executionStore.clearActiveJobIfStale(
    new Set([
      ...queueStore.runningTasks.map((task) => task.jobId),
      ...queueStore.pendingTasks.map((task) => task.jobId)
    ])
  )
}

const jobRef = (id: string) => activeJobs.value.find((job) => job.id === id)

const cancelJobById = wrapWithErrorHandlingAsync(async (id: string) => {
  const jobId = jobRef(id)?.taskRef?.jobId
  if (!jobId) return
  await api.cancelJob(String(jobId))
  executionStore.clearInitializationByJobId(String(jobId))
  await queueStore.update()
  reconcileActiveJob()
})

const cancelJobIds = wrapWithErrorHandlingAsync(async (ids: string[]) => {
  const jobIds = ids
    .map((id) => jobRef(id)?.taskRef?.jobId)
    .filter(
      (jobId): jobId is string => typeof jobId === 'string' && jobId.length > 0
    )
  if (!jobIds.length) return
  await api.cancelJobs(jobIds)
  executionStore.clearInitializationByJobIds(jobIds)
  await queueStore.update()
  reconcileActiveJob()
})

function handleCancel(job: JobView) {
  if (jobs.value.length <= 1) {
    cancelIntent.value = true
    expanded.value = false
  }
  void cancelJobById(job.id)
}
function handleClearQueue() {
  if (runningCount.value === 0) cancelIntent.value = true
  void cancelJobIds(queuedJobs.value.map((job) => job.id))
}
function handleCancelAll() {
  cancelIntent.value = true
  expanded.value = false
  void cancelJobIds(jobs.value.map((job) => job.id))
}

const { galleryActiveIndex, galleryItems, onViewItem } = useResultGallery(() =>
  recentJobs.value
    .map((job) => job.taskRef)
    .filter((task): task is TaskItemImpl => !!task)
)

async function onCompletedChipClick() {
  if (completedTimer !== undefined) {
    window.clearTimeout(completedTimer)
    completedTimer = undefined
  }
  completedFlash.value = false
  await nextTick()
  idleOpen.value = true
}

function handleGoToHistory() {
  idleOpen.value = false
  rightSidePanelStore.openPanel('job-history')
}

const jobThumbnail = (job: JobListItem): AugmentedResultItem | undefined =>
  job.taskRef?.previewOutput
const recentJobs = computed(() =>
  jobItems.value
    .filter((job) => job.state === 'completed')
    .slice(0, RECENT_JOB_LIMIT)
)
const recentResults = computed(() =>
  recentJobs.value.map((job) => {
    const thumb = jobThumbnail(job)
    return {
      id: job.id,
      job,
      name: thumb?.filename || job.title,
      meta: t('queueStatus.recentCompleted'),
      thumbSrc: thumb?.previewUrl,
      isVideo: thumb ? isVideoResult(thumb) : false
    }
  })
)

async function handleViewResult(job: JobListItem) {
  idleOpen.value = false
  await onViewItem(job)
}

onUnmounted(() => {
  if (autoOpenTimer !== undefined) window.clearTimeout(autoOpenTimer)
  if (completedTimer !== undefined) window.clearTimeout(completedTimer)
  if (hoverCloseTimer !== undefined) window.clearTimeout(hoverCloseTimer)
})
</script>

<style scoped>
.job-toast-row {
  animation: job-toast-row-in 260ms cubic-bezier(0.22, 1, 0.36, 1) both;
  animation-delay: var(--row-delay, 0ms);
}

@keyframes job-toast-row-in {
  from {
    opacity: 0;
    transform: translateY(-10px) scale(0.94);
  }
}

@media (prefers-reduced-motion: reduce) {
  .job-toast-row {
    animation-duration: 1ms;
    animation-delay: 0ms;
  }
}
</style>
