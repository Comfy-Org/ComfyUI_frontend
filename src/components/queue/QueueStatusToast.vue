<template>
  <div
    :class="
      cn(
        'relative inline-flex flex-col',
        alignStart ? 'items-start' : 'items-end'
      )
    "
  >
    <div
      v-if="showToast"
      :class="
        cn(
          'pointer-events-auto flex gap-1',
          above ? 'flex-col-reverse' : 'flex-col',
          alignStart ? 'items-start' : 'items-end'
        )
      "
      @pointerenter="openStack"
      @pointerleave="scheduleCloseStack"
    >
      <QueueStatusPill
        :label="pillLabel"
        :badge="pillBadge"
        :progress="pillProgress"
        :expanded="panelOpen"
        :terminal-kind="pillTerminalKind"
        :stack="peekDepth"
        @activate="onPillActivate"
      />

      <Transition
        enter-active-class="transition-[translate,scale,opacity] duration-250 ease-[cubic-bezier(0.32,0.72,0,1)]"
        leave-active-class="transition-[translate,scale,opacity] duration-150 ease-in"
        :enter-from-class="panelHiddenClass"
        :leave-to-class="panelHiddenClass"
      >
        <QueueStatusPanel
          v-if="panelOpen"
          :rows="panelRows"
          :queued-count="queuedCount"
          :results="recentResults"
          :above="above"
          :align-start="alignStart"
          @cancel="handleCancel"
          @clear-queue="handleClearQueue"
          @cancel-all="handleCancelAll"
          @view="handleViewResult"
          @history="handleGoToHistory"
        />
      </Transition>
    </div>

    <QueueStatusIdle
      v-else
      v-model:open="idleOpen"
      :label="idleLabel"
      :results="recentResults"
      :align="alignStart ? 'start' : 'end'"
      @view="handleViewResult"
      @history="handleGoToHistory"
    />

    <MediaLightbox
      v-model:active-index="galleryActiveIndex"
      :all-gallery-items="galleryItems"
    />
  </div>
</template>

<script setup lang="ts">
import { cn } from '@comfyorg/tailwind-utils'
import { computed, nextTick, onUnmounted, reactive, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'

import MediaLightbox from '@/components/sidebar/tabs/queue/MediaLightbox.vue'
import QueueStatusIdle from '@/components/queue/QueueStatusIdle.vue'
import QueueStatusPanel from '@/components/queue/QueueStatusPanel.vue'
import QueueStatusPill from '@/components/queue/QueueStatusPill.vue'
import { useJobList } from '@/composables/queue/useJobList'
import type { JobListItem } from '@/composables/queue/useJobList'
import { useResultGallery } from '@/composables/queue/useResultGallery'
import type {
  JobView,
  RecentResult,
  TerminalKind
} from '@/components/queue/queueStatusTypes'
import { useErrorHandling } from '@/composables/useErrorHandling'
import { api } from '@/scripts/api'
import { useExecutionStore } from '@/stores/executionStore'
import type { TaskItemImpl } from '@/stores/queueStore'
import type { AugmentedResultItem } from '@/utils/resultItem'
import { formatShortMonthDay, isToday } from '@/utils/dateTimeUtil'
import { isVideoResult } from '@/utils/resultItem'
import { resultItemPreviewUrl } from '@/utils/resultItemUrl'
import { useQueueStore } from '@/stores/queueStore'
import { useRightSidePanelStore } from '@/stores/workspace/rightSidePanelStore'

/** How long the terminal "Completed"/"Cancelled" chip lingers before idle returns. */
const COMPLETED_FLASH_MS = 3000
const RECENT_JOB_LIMIT = 4
/** First completion of the session auto-opens the recents popover, once. */
let popoverAutoOpened = false
const JOB_POPOVER_AUTO_OPEN_MS = 4000

const { above = false, alignStart = false } = defineProps<{
  above?: boolean
  alignStart?: boolean
}>()

const { t, n, locale } = useI18n()
const queueStore = useQueueStore()
const executionStore = useExecutionStore()
const { wrapWithErrorHandlingAsync } = useErrorHandling()
const { jobItems } = useJobList()
const rightSidePanelStore = useRightSidePanelStore()

/** The user folded the deck; jobs stay visible until they do. */
const collapsed = ref(false)
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
/** Every job of the current batch, so the drain is judged by how each ended. */
const lastActiveIds = new Set<string>()
watch(
  activeJobs,
  (current) => {
    for (const job of current) lastActiveIds.add(job.id)
  },
  { immediate: true }
)
const isRunningState = (state: JobListItem['state']) =>
  state === 'running' || state === 'initialization'

const jobs = computed<JobView[]>(() => {
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
const terminalKind = ref<TerminalKind>('completed')
const cancelIntent = ref(false)

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
    terminalKind.value = outcomeOf([...lastActiveIds])
    lastActiveIds.clear()
    cancelIntent.value = false
    completedFlash.value = true
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
const fanned = computed(() => !isTerminal.value && hovered.value)

const headlineProgress = computed(() => runningJobs.value[0]?.progress ?? 0)

const pillLabel = computed(() => {
  if (isTerminal.value) {
    if (terminalKind.value === 'failed') return t('queueStatus.failed')
    return terminalKind.value === 'cancelled'
      ? t('queueStatus.cancelled')
      : t('queueStatus.completed')
  }
  if (runningCount.value > 1)
    return t('queueStatus.runningCount', { count: runningCount.value })
  if (runningCount.value === 1) return t('queueStatus.running')
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

const idleLabel = computed(() => {
  const count = queueStore.activeJobsCount
  return t(
    'sideToolbar.queueProgressOverlay.activeJobsShort',
    { count: n(count) },
    count
  )
})

const startedLabels = reactive<Record<string, string>>({})
watch(
  () => runningJobs.value.map((job) => job.id),
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
const peekDepth = computed(() => (panelOpen.value ? 0 : stackCount.value))
const panelOpen = computed(
  () => !isTerminal.value && (!collapsed.value || fanned.value)
)
const panelHiddenClass = computed(() =>
  cn('scale-[0.98] opacity-0', above ? 'translate-y-2' : '-translate-y-2')
)
const pillBadge = computed(() => queuedBadge.value ?? undefined)
const pillProgress = computed(() =>
  showProgressLine.value ? headlineProgress.value : undefined
)
const pillTerminalKind = computed(() =>
  isTerminal.value ? terminalKind.value : null
)
function onPillActivate() {
  if (!isTerminal.value) {
    collapsed.value = !collapsed.value
    return
  }
  if (terminalKind.value === 'completed') void onCompletedChipClick()
  else onTerminalChipClickToHistory()
}
const panelRows = computed(() =>
  jobs.value.map((job) => ({ job, subtitle: jobSubtitle(job) }))
)

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
  if (jobs.value.length <= 1) cancelIntent.value = true
  void cancelJobById(job.id)
}
function handleClearQueue() {
  if (runningCount.value === 0) cancelIntent.value = true
  void cancelJobIds(queuedJobs.value.map((job) => job.id))
}
function handleCancelAll() {
  cancelIntent.value = true
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
function onTerminalChipClickToHistory() {
  if (completedTimer !== undefined) {
    window.clearTimeout(completedTimer)
    completedTimer = undefined
  }
  completedFlash.value = false
  handleGoToHistory()
}

const jobThumbnail = (job: JobListItem): AugmentedResultItem | undefined =>
  job.taskRef?.previewOutput
const recentJobs = computed(() =>
  jobItems.value
    .filter((job) => job.state === 'completed')
    .slice(0, RECENT_JOB_LIMIT)
)
const completedMeta = (job: JobListItem): string => {
  const ts = job.taskRef?.executionEndTimestamp ?? job.taskRef?.job.create_time
  if (!ts) return t('queueStatus.completed')
  const time = new Intl.DateTimeFormat(locale.value, {
    hour: 'numeric',
    minute: '2-digit'
  }).format(new Date(ts))
  const when = isToday(ts)
    ? time
    : `${formatShortMonthDay(ts, locale.value)}, ${time}`
  return `${t('queueStatus.completed')} · ${when}`
}
const recentResults = computed<RecentResult[]>(() =>
  recentJobs.value.map((job) => {
    const thumb = jobThumbnail(job)
    return {
      id: job.id,
      job,
      name: thumb?.display_name?.trim() || thumb?.filename || job.title,
      meta: completedMeta(job),
      thumbSrc: thumb ? resultItemPreviewUrl(thumb) : undefined,
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
:deep(.job-toast-row) {
  animation: job-toast-row-in 240ms cubic-bezier(0.32, 0.72, 0, 1) both;
  animation-delay: var(--row-delay, 0ms);
}

@keyframes job-toast-row-in {
  from {
    opacity: 0;
    transform: translateY(-6px) scale(0.97);
  }
}

@media (prefers-reduced-motion: reduce) {
  :deep(.job-toast-row) {
    animation-duration: 1ms;
    animation-delay: 0ms;
  }
}
</style>
