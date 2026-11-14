import { computed } from 'vue'
import type { ComputedRef, Ref } from 'vue'

import type { useExecutionStore } from '@/stores/executionStore'
import type { TaskItemImpl, useQueueStore } from '@/stores/queueStore'
import type { JobState } from '@/types/queue'

type QueueStore = ReturnType<typeof useQueueStore>
type ExecutionStore = ReturnType<typeof useExecutionStore>

export type UseQueueEstimatesOptions = {
  queueStore: QueueStore
  executionStore: ExecutionStore
  taskForJob: ComputedRef<TaskItemImpl | null>
  jobState: ComputedRef<JobState | null>
  firstSeenTs: ComputedRef<number | undefined>
  jobsAhead: ComputedRef<number | null>
  nowTs: Ref<number>
}

type EstimateRange = [number, number]

export const formatElapsedTime = (ms: number): string => {
  const totalSec = Math.max(0, Math.floor(ms / 1000))
  const minutes = Math.floor(totalSec / 60)
  const seconds = totalSec % 60
  return `${minutes}m ${seconds}s`
}

function pickRecentDurations(queueStore: QueueStore, workflowId?: string) {
  return queueStore.historyTasks
    .filter(
      (task) => workflowId === undefined || task.workflowId === workflowId
    )
    .map((task: TaskItemImpl) => Number(task.executionTimeInSeconds))
    .filter(
      (value: number | undefined) =>
        typeof value === 'number' && !Number.isNaN(value)
    )
    .slice(-20)
}

export const useQueueEstimates = ({
  queueStore,
  executionStore,
  taskForJob,
  jobState,
  firstSeenTs,
  jobsAhead,
  nowTs
}: UseQueueEstimatesOptions) => {
  const runningWorkflowCount = computed(
    () => executionStore.runningWorkflowCount
  )

  const showParallelQueuedStats = computed(
    () =>
      jobState.value === 'pending' &&
      !!firstSeenTs.value &&
      runningWorkflowCount.value > 1
  )

  const recentDurations = computed<number[]>(() =>
    pickRecentDurations(queueStore)
  )

  function durationsForTask(task: TaskItemImpl | null): number[] {
    const workflowId = task?.workflowId
    if (!workflowId) return recentDurations.value
    const durations = pickRecentDurations(queueStore, workflowId)
    return durations.length ? durations : recentDurations.value
  }

  const runningRemainingRangeSeconds = computed<EstimateRange | null>(() => {
    const running = queueStore.runningTasks
    const now = nowTs.value
    const remaining = running.flatMap((task) => {
      const startTs = task.executionStartTimestamp
      if (typeof startTs !== 'number') return []
      const durations = durationsForTask(task)
      if (!durations.length) return []
      const sorted = durations.slice().sort((a, b) => a - b)
      const avg = sorted.reduce((sum, value) => sum + value, 0) / sorted.length
      const p75 =
        sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * 0.75))]
      const elapsed = Math.max(0, Math.floor((now - startTs) / 1000))
      return [
        {
          lo: Math.max(0, Math.round(avg - elapsed)),
          hi: Math.max(0, Math.round(p75 - elapsed))
        }
      ]
    })
    if (!remaining.length) return null
    const minLo = remaining.reduce(
      (min, range) => Math.min(min, range.lo),
      Infinity
    )
    const minHi = remaining.reduce(
      (min, range) => Math.min(min, range.hi),
      Infinity
    )
    return [minLo, minHi]
  })

  const estimateRangeSeconds = computed<EstimateRange | null>(() => {
    const durations = recentDurations.value
    if (!durations.length) return null
    const ahead = jobsAhead.value
    if (ahead == null) return null
    const sorted = durations.slice().sort((a, b) => a - b)
    const avg = sorted.reduce((sum, value) => sum + value, 0) / sorted.length
    const p75 =
      sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * 0.75))]
    if (ahead <= 0) {
      return runningRemainingRangeSeconds.value ?? [0, 0]
    }
    const runningCount = Math.max(1, runningWorkflowCount.value || 1)
    const batches = Math.ceil(ahead / runningCount)
    return [Math.round(avg * batches), Math.round(p75 * batches)]
  })

  const estimateRemainingRangeSeconds = computed<EstimateRange | null>(() => {
    const durations = durationsForTask(taskForJob.value)
    if (!durations.length) return null
    const sorted = durations.slice().sort((a, b) => a - b)
    const avg = sorted.reduce((sum, value) => sum + value, 0) / sorted.length
    const p75 =
      sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * 0.75))]
    const execStart =
      jobState.value === 'running'
        ? taskForJob.value?.executionStartTimestamp
        : undefined
    const baseTs = execStart ?? firstSeenTs.value
    const elapsed = baseTs
      ? Math.max(0, Math.floor((nowTs.value - baseTs) / 1000))
      : 0
    const lo = Math.max(0, Math.round(avg - elapsed))
    const hi = Math.max(0, Math.round(p75 - elapsed))
    return [lo, hi]
  })

  const timeElapsedValue = computed(() => {
    const execStart =
      jobState.value === 'running'
        ? taskForJob.value?.executionStartTimestamp
        : undefined
    const baseTs = execStart ?? firstSeenTs.value
    if (!baseTs) return ''
    return formatElapsedTime(nowTs.value - baseTs)
  })

  return {
    runningWorkflowCount,
    showParallelQueuedStats,
    estimateRangeSeconds,
    estimateRemainingRangeSeconds,
    timeElapsedValue
  }
}
