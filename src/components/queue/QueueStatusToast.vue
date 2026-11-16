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
    >
      <QueueStatusPill
        :label="pillLabel"
        :badge="pillBadge"
        :progress="pillProgress"
        :expanded="panelOpen"
        :terminal-kind="pillTerminalKind"
        :thumb-src="pillThumb"
        @activate="onPillActivate"
        @stop="handleCancelAll"
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
          :above="above"
          :align-start="alignStart"
          @cancel="handleCancel"
          @clear-queue="handleClearQueue"
          @cancel-all="handleCancelAll"
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
      @open-workflow="handleOpenWorkflow"
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
import { useNow } from '@vueuse/core'
import { computed, nextTick, onUnmounted, reactive, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'

import {
  executedNodesPercent,
  formatElapsed
} from '@/components/queue/queueStatusFormat'
import MediaLightbox from '@/components/sidebar/tabs/queue/MediaLightbox.vue'
import QueueStatusIdle from '@/components/queue/QueueStatusIdle.vue'
import QueueStatusPanel from '@/components/queue/QueueStatusPanel.vue'
import QueueStatusPill from '@/components/queue/QueueStatusPill.vue'
import { useJobList } from '@/composables/queue/useJobList'
import type { JobListItem } from '@/composables/queue/useJobList'
import { useResultGallery } from '@/composables/queue/useResultGallery'
import type {
  HeldReason,
  JobView,
  RecentResult,
  TerminalKind
} from '@/components/queue/queueStatusTypes'
import { useErrorHandling } from '@/composables/useErrorHandling'
import { api } from '@/scripts/api'
import { app } from '@/scripts/app'
import { useWorkflowStore } from '@/platform/workflow/management/stores/workflowStore'
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

const { above = false, alignStart = false } = defineProps<{
  above?: boolean
  alignStart?: boolean
}>()

const emit = defineEmits<{ panelOpen: [open: boolean] }>()

const { t, n, locale } = useI18n()
const queueStore = useQueueStore()
const executionStore = useExecutionStore()
const workflowStore = useWorkflowStore()
const { wrapWithErrorHandlingAsync } = useErrorHandling()
const { jobItems } = useJobList()
const rightSidePanelStore = useRightSidePanelStore()

/** The user's own open/close choice; null follows the default. */
const userOpen = ref<boolean | null>(null)
const idleOpen = ref(false)
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
const lastActiveIds = reactive(new Set<string>())
watch(
  activeJobs,
  (current) => {
    for (const job of current) lastActiveIds.add(job.id)
  },
  { immediate: true }
)
const isRunningState = (state: JobListItem['state']) =>
  state === 'running' || state === 'initialization'

/**
 * Each running job reads its own executed-node count, so parallel runs never
 * borrow the progress of whichever job sent the last message.
 */
function jobProgress(job: JobListItem): number {
  const jobId = job.taskRef?.jobId
  return executedNodesPercent(
    jobId ? executionStore.queuedJobs[jobId]?.nodes : undefined,
    job.progressTotalPercent ?? 0,
    jobId ? executionStore.nodeProgressStatesByJob[jobId] : undefined
  )
}

/**
 * A row names the workflow it runs. The job list's own title is a status
 * ("Running", "Total: 40%"), which reads the same on every parallel row.
 */
function workflowName(job: JobListItem): string | undefined {
  const jobId = job.taskRef?.jobId
  if (!jobId) return undefined
  const workflow = executionStore.queuedJobs[jobId]?.workflow
  if (workflow?.filename) return workflow.filename
  const path = executionStore.jobIdToSessionWorkflowPath.get(jobId)
  if (!path) {
    // After a reload only the graph id survives; match it to an open tab.
    const graphId = job.taskRef?.workflowId
    const open = graphId
      ? workflowStore.openWorkflows.find(
          (w) => (w.activeState?.id ?? w.initialState?.id) === graphId
        )
      : undefined
    if (open) return open.filename
  }
  return (
    path
      ?.split('/')
      .pop()
      ?.replace(/\.json$/i, '') || undefined
  )
}
function jobTitle(job: JobListItem): string {
  if (!job.taskRef?.jobId) return job.title
  return workflowName(job) ?? t('g.untitled')
}

/** Failed jobs of the running batch, until the batch drains or is dismissed. */
const dismissedFailedIds = reactive(new Set<string>())
const failedInBatch = computed(() =>
  jobItems.value.filter(
    (job) =>
      lastActiveIds.has(job.id) &&
      !dismissedFailedIds.has(job.id) &&
      job.taskRef?.displayStatus === 'Failed'
  )
)

const jobs = computed<JobView[]>(() => {
  const running = activeJobs.value.filter((job) => isRunningState(job.state))
  const queued = activeJobs.value.filter((job) => job.state === 'pending')
  return [
    ...running.map((job) => ({
      id: job.id,
      title: jobTitle(job),
      status: 'running' as const,
      progress: jobProgress(job),
      queuePosition: 0
    })),
    ...queued.map((job, index) => ({
      id: job.id,
      title: jobTitle(job),
      status: 'queued' as const,
      progress: 0,
      queuePosition: index + 1
    }))
  ]
})

const failedRows = computed<JobView[]>(() =>
  failedInBatch.value.map((job) => ({
    id: job.id,
    title: jobTitle(job),
    status: 'failed' as const,
    progress: 0,
    queuePosition: 0
  }))
)

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
  // Stopping the batch is the last thing the user did, so it wins.
  if (cancelIntent.value) return 'cancelled'
  if (outcomes.some((status) => status === 'Failed')) return 'failed'
  if (outcomes.some((status) => status === 'Cancelled')) return 'cancelled'
  return 'completed'
}

watch(activeCount, (count, prev) => {
  if (count === 0 && (prev ?? 0) > 0) {
    terminalKind.value = outcomeOf([...lastActiveIds])
    lastActiveIds.clear()
    dismissedFailedIds.clear()
    cancelIntent.value = false
    userOpen.value = null
    completedFlash.value = true
    if (completedTimer !== undefined) window.clearTimeout(completedTimer)
    completedTimer = window.setTimeout(() => {
      completedTimer = undefined
      completedFlash.value = false
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

const showToast = computed(() => activeCount.value > 0 || completedFlash.value)
const isTerminal = computed(
  () => completedFlash.value && activeCount.value === 0
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
    return t('queueStatus.runningCountShort', { count: runningCount.value })
  if (runningCount.value === 1)
    return t('queueStatus.runningPercent', { percent: headlineProgress.value })
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

/** When each job was first seen running, for its elapsed time. */
const startedAt = reactive<Record<string, number>>({})
const now = useNow({ interval: 1000 })
watch(
  () => runningJobs.value.map((job) => job.id),
  (ids) => {
    for (const id of ids) {
      startedAt[id] ??= Date.now()
    }
  },
  { immediate: true }
)
const HELD_LABEL_KEYS: Record<HeldReason, string> = {
  plan: 'queueStatus.heldPlan',
  partner: 'queueStatus.heldPartner',
  provider: 'queueStatus.heldProvider'
}
function jobSubtitle(job: JobView): string {
  if (job.status === 'running') {
    const started = startedAt[job.id]
    const percent = `${job.progress}%`
    return started !== undefined
      ? `${formatElapsed(now.value.getTime() - started)} · ${percent}`
      : percent
  }
  if (job.status === 'failed') return t('queueStatus.failedRow')
  if (job.status === 'held') {
    return t(HELD_LABEL_KEYS[job.heldBy ?? 'plan'])
  }
  return job.queuePosition === 1
    ? t('queueStatus.queuedNextUp')
    : t('queueStatus.queuedPosition', { position: job.queuePosition })
}
/** One run stays a compact pill; several open the card until the user folds it. */
const panelOpen = computed(
  () => !isTerminal.value && (userOpen.value ?? activeCount.value > 1)
)
/** Any open list (the card or Recent results) hides the error notice under it. */
watch(
  () => panelOpen.value || idleOpen.value,
  (open) => emit('panelOpen', open),
  { immediate: true }
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
const pillThumb = computed(() =>
  isTerminal.value && terminalKind.value === 'completed'
    ? recentResults.value[0]?.thumbSrc
    : undefined
)
function onPillActivate() {
  if (!isTerminal.value) {
    userOpen.value = !panelOpen.value
    return
  }
  if (terminalKind.value === 'completed') void onCompletedChipClick()
  else onTerminalChipClickToHistory()
}
const panelRows = computed(() =>
  [...runningJobs.value, ...failedRows.value, ...queuedJobs.value].map(
    (job) => ({ job, subtitle: jobSubtitle(job) })
  )
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

/** `drainsQueue` marks the intent only once the backend accepted the cancel. */
const cancelJobById = wrapWithErrorHandlingAsync(
  async (id: string, drainsQueue: boolean) => {
    const jobId = jobRef(id)?.taskRef?.jobId
    if (!jobId) return
    await api.cancelJob(String(jobId))
    if (drainsQueue) cancelIntent.value = true
    executionStore.clearInitializationByJobId(String(jobId))
    await queueStore.update()
    reconcileActiveJob()
  }
)

const cancelJobIds = wrapWithErrorHandlingAsync(
  async (ids: string[], drainsQueue: boolean) => {
    const jobIds = ids
      .map((id) => jobRef(id)?.taskRef?.jobId)
      .filter(
        (jobId): jobId is string =>
          typeof jobId === 'string' && jobId.length > 0
      )
    if (!jobIds.length) return
    await api.cancelJobs(jobIds)
    if (drainsQueue) cancelIntent.value = true
    executionStore.clearInitializationByJobIds(jobIds)
    await queueStore.update()
    reconcileActiveJob()
  }
)

function handleCancel(job: JobView) {
  void cancelJobById(job.id, activeCount.value <= 1)
}
function handleClearQueue() {
  void cancelJobIds(
    queuedJobs.value.map((job) => job.id),
    runningCount.value === 0
  )
}
function handleCancelAll() {
  void cancelJobIds(
    jobs.value.map((job) => job.id),
    true
  )
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
  const count = job.taskRef?.outputsCount ?? 0
  const outputs =
    count > 1 ? ` · ${t('queueStatus.outputsCount', { count }, count)}` : ''
  return `${t('queueStatus.completed')} · ${when}${outputs}`
}
const recentResults = computed<RecentResult[]>(() =>
  recentJobs.value.map((job) => {
    const thumb = jobThumbnail(job)
    return {
      id: job.id,
      job,
      name:
        workflowName(job) ??
        (thumb?.display_name?.trim() || thumb?.filename || job.title),
      meta: completedMeta(job),
      thumbSrc: thumb ? resultItemPreviewUrl(thumb) : undefined,
      isVideo: thumb ? isVideoResult(thumb) : false
    }
  })
)

const openWorkflow = wrapWithErrorHandlingAsync(async (task: TaskItemImpl) => {
  await task.loadWorkflow(app)
})
function handleOpenWorkflow(job: JobListItem) {
  idleOpen.value = false
  if (job.taskRef) void openWorkflow(job.taskRef)
}

async function handleViewResult(job: JobListItem) {
  idleOpen.value = false
  await onViewItem(job)
}

onUnmounted(() => {
  if (completedTimer !== undefined) window.clearTimeout(completedTimer)
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
