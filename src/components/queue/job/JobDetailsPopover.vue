<template>
  <div
    class="w-[300px] min-w-[260px] rounded-lg border border-[var(--color-charcoal-400)] bg-[var(--color-charcoal-800)] shadow-md"
  >
    <div
      class="flex items-center border-b border-[var(--color-charcoal-400)] p-4"
    >
      <span
        class="text-[0.875rem] leading-normal font-normal text-text-primary"
        >{{ headerText }}</span
      >
    </div>
    <div class="flex flex-col gap-6 px-4 pt-4 pb-4">
      <div class="grid grid-cols-2 items-center gap-x-2 gap-y-2">
        <template v-for="row in baseRows" :key="row.label">
          <div
            class="flex items-center text-[0.75rem] leading-normal font-normal text-text-primary"
          >
            {{ row.label }}
          </div>
          <div
            class="flex min-w-0 items-center text-[0.75rem] leading-normal font-normal text-[var(--color-slate-100)]"
          >
            <span class="block min-w-0 truncate">{{ row.value }}</span>
            <button
              v-if="row.canCopy"
              type="button"
              class="ml-2 inline-flex size-6 items-center justify-center rounded border-0 bg-transparent p-0 hover:opacity-90"
              :aria-label="copyAriaLabel"
              @click.stop="copyJobId"
            >
              <i
                class="icon-[lucide--copy] block size-4 leading-none text-[var(--color-slate-100)]"
              />
            </button>
          </div>
        </template>
      </div>

      <div
        v-if="extraRows.length"
        class="grid grid-cols-2 items-center gap-x-2 gap-y-2"
      >
        <template v-for="row in extraRows" :key="row.label">
          <div
            class="flex items-center text-[0.75rem] leading-normal font-normal text-text-primary"
          >
            {{ row.label }}
          </div>
          <div
            class="flex min-w-0 items-center text-[0.75rem] leading-normal font-normal text-[var(--color-slate-100)]"
          >
            <span class="block min-w-0 truncate">{{ row.value }}</span>
          </div>
        </template>
      </div>

      <div v-if="jobState === 'failed'" class="grid grid-cols-2 gap-x-2">
        <div
          class="flex items-center text-[0.75rem] leading-normal font-normal text-text-primary"
        >
          {{ errorMessageLabel }}
        </div>
        <div class="flex items-center justify-between gap-4">
          <button
            type="button"
            class="inline-flex h-6 items-center justify-center gap-2 rounded border-none bg-transparent px-0 text-[0.75rem] leading-none text-[var(--color-slate-100)] hover:opacity-90"
            :aria-label="copyAriaLabel"
            @click.stop="copyErrorMessage"
          >
            <span>{{ copyAriaLabel }}</span>
            <i class="icon-[lucide--copy] block size-3.5 leading-none" />
          </button>
          <button
            type="button"
            class="inline-flex h-6 items-center justify-center gap-2 rounded border-none bg-transparent px-0 text-[0.75rem] leading-none text-[var(--color-slate-100)] hover:opacity-90"
            @click.stop="reportJobError"
          >
            <span>{{ reportLabel }}</span>
            <i
              class="icon-[lucide--message-circle-warning] block size-3.5 leading-none"
            />
          </button>
        </div>
        <div
          class="col-span-2 mt-2 rounded bg-[var(--color-charcoal-700)] px-4 py-2 text-[0.75rem] leading-normal text-[var(--color-slate-100)]"
        >
          {{ errorMessageValue }}
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'

import { useCopyToClipboard } from '@/composables/useCopyToClipboard'
import { st, t } from '@/i18n'
import { useWorkflowStore } from '@/platform/workflow/management/stores/workflowStore'
import type { ExecutionErrorWsMessage } from '@/schemas/apiSchema'
import { useDialogService } from '@/services/dialogService'
import { useExecutionStore } from '@/stores/executionStore'
import { useQueueStore } from '@/stores/queueStore'
import type { TaskItemImpl } from '@/stores/queueStore'
import { formatClockTime } from '@/utils/dateTimeUtil'
import { jobStateFromTask } from '@/utils/queueUtil'

const props = defineProps<{
  jobId: string
  workflowId?: string
}>()

const headerText = computed(() => st('queue.jobDetails.header', 'Job Details'))
const workflowLabel = computed(() =>
  st('queue.jobDetails.workflow', 'Workflow')
)
const jobIdLabel = computed(() => st('queue.jobDetails.jobId', 'Job ID'))
const copyAriaLabel = computed(() => t('g.copy'))

const workflowStore = useWorkflowStore()
const queueStore = useQueueStore()
const executionStore = useExecutionStore()
const { locale } = useI18n()

const workflowValue = computed(() => {
  const wid = props.workflowId
  if (!wid) return ''
  const activeId = workflowStore.activeWorkflow?.activeState?.id
  if (activeId && activeId === wid) {
    return workflowStore.activeWorkflow?.filename ?? wid
  }
  return wid
})
const jobIdValue = computed(() => props.jobId)

const { copyToClipboard } = useCopyToClipboard()
const copyJobId = () => void copyToClipboard(jobIdValue.value)

const taskForJob = computed(() => {
  const pid = props.jobId
  const findIn = (arr: TaskItemImpl[]) =>
    arr.find((t) => String(t.promptId ?? '') === String(pid))
  return (
    findIn(queueStore.pendingTasks) ||
    findIn(queueStore.runningTasks) ||
    findIn(queueStore.historyTasks) ||
    null
  )
})

const jobState = computed(() => {
  const task = taskForJob.value
  if (!task) return null
  const isInitializing = executionStore.isPromptInitializing(
    String(task?.promptId)
  )
  return jobStateFromTask(task, isInitializing)
})

const firstSeenTs = computed<number | undefined>(() => {
  const task = taskForJob.value
  return task?.createTime
})

const queuedAtLabel = computed(() =>
  st('queue.jobDetails.queuedAt', 'Queued at')
)
const queuePositionLabel = computed(() =>
  st('queue.jobDetails.queuePosition', 'Queue position')
)
const timeElapsedLabel = computed(() =>
  st('queue.jobDetails.timeElapsed', 'Time elapsed')
)
const estimatedStartInLabel = computed(() =>
  st('queue.jobDetails.estimatedStartIn', 'Estimated to start in')
)
const estimatedFinishInLabel = computed(() =>
  st('queue.jobDetails.estimatedFinishIn', 'Estimated to finish in')
)
const generatedOnLabel = computed(() =>
  st('queue.jobDetails.generatedOn', 'Generated on')
)
const totalGenerationTimeLabel = computed(() =>
  st('queue.jobDetails.totalGenerationTime', 'Total generation time')
)
const computeHoursUsedLabel = computed(() =>
  st('queue.jobDetails.computeHoursUsed', 'Compute hours used')
)
const failedAfterLabel = computed(() =>
  st('queue.jobDetails.failedAfter', 'Failed after')
)
const errorMessageLabel = computed(() =>
  st('queue.jobDetails.errorMessage', 'Error message')
)
const reportLabel = computed(() => st('queue.jobDetails.report', 'Report'))

const queuedAtValue = computed(() =>
  firstSeenTs.value !== undefined
    ? formatClockTime(firstSeenTs.value, locale.value)
    : ''
)

const runningWorkflowCount = computed(() => executionStore.runningWorkflowCount)
const showParallelQueuedStats = computed(
  () =>
    (jobState.value === 'queued' || jobState.value === 'added') &&
    !!firstSeenTs.value &&
    (runningWorkflowCount.value ?? 0) > 1
)

const currentQueueIndex = computed<number | null>(() => {
  const task = taskForJob.value
  return task ? Number(task.queueIndex) : null
})

const jobsAhead = computed<number | null>(() => {
  const idx = currentQueueIndex.value
  if (idx == null) return null
  const ahead = queueStore.pendingTasks.filter(
    (t: TaskItemImpl) => Number(t.queueIndex) < idx
  )
  return ahead.length
})

const queuePositionValue = computed(() => {
  if (jobsAhead.value == null) return ''
  const n = jobsAhead.value
  return t('queue.jobDetails.queuePositionValue', { count: n }, n)
})

const nowTs = ref<number>(Date.now())
let timer: number | null = null
onMounted(() => {
  timer = window.setInterval(() => {
    nowTs.value = Date.now()
  }, 1000)
})
onUnmounted(() => {
  if (timer != null) {
    clearInterval(timer)
    timer = null
  }
})

const formatElapsed = (ms: number): string => {
  const totalSec = Math.max(0, Math.floor(ms / 1000))
  const m = Math.floor(totalSec / 60)
  const s = totalSec % 60
  return `${m}m ${s}s`
}

const timeElapsedValue = computed(() => {
  const task = taskForJob.value as any
  const execStart =
    jobState.value === 'running' ? task?.executionStartTimestamp : undefined
  const baseTs = execStart ?? firstSeenTs.value
  if (!baseTs) return ''
  return formatElapsed(nowTs.value - baseTs)
})

const recentDurations = computed<number[]>(() => {
  return queueStore.historyTasks
    .map((t: TaskItemImpl) => Number(t.executionTimeInSeconds))
    .filter(
      (v: number | undefined) => typeof v === 'number' && !Number.isNaN(v)
    ) as number[]
})

const runningRemainingRangeSeconds = computed<[number, number] | null>(() => {
  const durations = recentDurations.value.slice(-20)
  if (!durations.length) return null
  const sorted = durations.slice().sort((a, b) => a - b)
  const avg = sorted.reduce((a, b) => a + b, 0) / sorted.length
  const p75 =
    sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * 0.75))]
  const running = queueStore.runningTasks as TaskItemImpl[]
  const now = nowTs.value
  const remaining: Array<{ lo: number; hi: number }> = running
    .map((t) => t.executionStartTimestamp)
    .filter((ts): ts is number => typeof ts === 'number')
    .map((startTs) => {
      const elapsed = Math.max(0, Math.floor((now - startTs) / 1000))
      return {
        lo: Math.max(0, Math.round(avg - elapsed)),
        hi: Math.max(0, Math.round(p75 - elapsed))
      }
    })
  if (!remaining.length) return null
  const minLo = remaining.reduce((m, r) => Math.min(m, r.lo), Infinity)
  const minHi = remaining.reduce((m, r) => Math.min(m, r.hi), Infinity)
  return [minLo, minHi]
})

const estimateRangeSeconds = computed<[number, number] | null>(() => {
  const durations = recentDurations.value.slice(-20)
  if (!durations.length) return null
  const rCount = Math.max(1, runningWorkflowCount.value || 1)
  const ahead = jobsAhead.value
  if (ahead == null) return null
  if (ahead <= 0) {
    const rr = runningRemainingRangeSeconds.value
    return rr ?? [0, 0]
  }
  const sorted = durations.slice().sort((a, b) => a - b)
  const avg = sorted.reduce((a, b) => a + b, 0) / sorted.length
  const p75 =
    sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * 0.75))]
  const batches = Math.ceil(ahead / rCount)
  return [Math.round(avg * batches), Math.round(p75 * batches)]
})

const formatEta = (lo: number, hi: number): string => {
  if (hi <= 60) {
    const hiS = Math.max(1, Math.round(hi))
    const loS = Math.max(1, Math.min(hiS, Math.round(lo)))
    if (loS === hiS)
      return t('queue.jobDetails.eta.seconds', { count: hiS }, hiS)
    return t('queue.jobDetails.eta.secondsRange', { lo: loS, hi: hiS })
  }
  if (lo >= 60 && hi < 90) {
    return t('queue.jobDetails.eta.minutes', { count: 1 }, 1)
  }
  const loM = Math.max(1, Math.floor(lo / 60))
  const hiM = Math.max(loM, Math.ceil(hi / 60))
  if (loM === hiM) {
    return t('queue.jobDetails.eta.minutes', { count: loM }, loM)
  }
  return t('queue.jobDetails.eta.minutesRange', { lo: loM, hi: hiM })
}

const estimatedStartInValue = computed(() => {
  const range = estimateRangeSeconds.value
  if (!range) return ''
  const [lo, hi] = range
  return formatEta(lo, hi)
})

const estimateRemainingRangeSeconds = computed<[number, number] | null>(() => {
  const durations = recentDurations.value.slice(-20)
  if (!durations.length) return null
  const sorted = durations.slice().sort((a, b) => a - b)
  const avg = sorted.reduce((a, b) => a + b, 0) / sorted.length
  const p75 =
    sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * 0.75))]
  const task = taskForJob.value as any
  const execStart =
    jobState.value === 'running' ? task?.executionStartTimestamp : undefined
  const baseTs = execStart ?? firstSeenTs.value
  const elapsed = baseTs
    ? Math.max(0, Math.floor((nowTs.value - baseTs) / 1000))
    : 0
  const lo = Math.max(0, Math.round(avg - elapsed))
  const hi = Math.max(0, Math.round(p75 - elapsed))
  return [lo, hi]
})

const estimatedFinishInValue = computed(() => {
  const range = estimateRemainingRangeSeconds.value
  if (!range) return ''
  const [lo, hi] = range
  return formatEta(lo, hi)
})

type DetailRow = { label: string; value: string; canCopy?: boolean }

const baseRows = computed<DetailRow[]>(() => [
  { label: workflowLabel.value, value: workflowValue.value },
  { label: jobIdLabel.value, value: jobIdValue.value, canCopy: true }
])

const extraRows = computed<DetailRow[]>(() => {
  if (jobState.value === 'queued' || jobState.value === 'added') {
    if (!firstSeenTs.value) return []
    const rows: DetailRow[] = [
      { label: queuedAtLabel.value, value: queuedAtValue.value }
    ]
    if (showParallelQueuedStats.value) {
      rows.push(
        { label: queuePositionLabel.value, value: queuePositionValue.value },
        { label: timeElapsedLabel.value, value: timeElapsedValue.value },
        {
          label: estimatedStartInLabel.value,
          value: estimatedStartInValue.value
        }
      )
    }
    return rows
  }
  if (jobState.value === 'running') {
    if (!firstSeenTs.value) return []
    return [
      { label: queuedAtLabel.value, value: queuedAtValue.value },
      { label: timeElapsedLabel.value, value: timeElapsedValue.value },
      {
        label: estimatedFinishInLabel.value,
        value: estimatedFinishInValue.value
      }
    ]
  }
  if (jobState.value === 'completed') {
    const task = taskForJob.value as any
    const endTs: number | undefined = task?.executionEndTimestamp
    const execMs: number | undefined = task?.executionTime
    const generatedOnValue = endTs ? formatClockTime(endTs, locale.value) : ''
    const totalGenTimeValue = execMs !== undefined ? formatElapsed(execMs) : ''
    const computeHoursValue =
      execMs !== undefined ? (execMs / 3600000).toFixed(3) + ' hours' : ''

    return [
      { label: generatedOnLabel.value, value: generatedOnValue },
      { label: totalGenerationTimeLabel.value, value: totalGenTimeValue },
      { label: computeHoursUsedLabel.value, value: computeHoursValue }
    ]
  }
  if (jobState.value === 'failed') {
    const task = taskForJob.value as any
    const execMs: number | undefined = task?.executionTime
    const failedAfterValue = execMs !== undefined ? formatElapsed(execMs) : ''
    const computeHoursValue =
      execMs !== undefined ? (execMs / 3600000).toFixed(3) + ' hours' : ''
    return [
      { label: queuedAtLabel.value, value: queuedAtValue.value },
      { label: failedAfterLabel.value, value: failedAfterValue },
      { label: computeHoursUsedLabel.value, value: computeHoursValue }
    ]
  }
  return []
})

const errorMessageValue = computed(() => {
  const task = taskForJob.value as any
  const msgs = task?.status?.messages as any[] | undefined
  if (!msgs?.length) return ''
  const err = msgs.find((m: any) => m?.[0] === 'execution_error')
  return String(err?.[1]?.exception_message ?? '')
})

const copyErrorMessage = () => {
  if (errorMessageValue.value) void copyToClipboard(errorMessageValue.value)
}

const reportJobError = () => {
  const task = taskForJob.value as any
  const msgs = task?.status?.messages as any[] | undefined
  if (!msgs?.length) return
  const err = msgs.find((m: any) => m?.[0] === 'execution_error')?.[1] as
    | ExecutionErrorWsMessage
    | undefined
  const dialog = useDialogService()
  if (err) {
    dialog.showExecutionErrorDialog(err)
  } else if (errorMessageValue.value) {
    dialog.showErrorDialog(new Error(errorMessageValue.value), {
      reportType: 'queueJobError'
    })
  }
}
</script>
