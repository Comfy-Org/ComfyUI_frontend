import { Semaphore, delay, withTimeout } from 'es-toolkit'
import { watch } from 'vue'

import type { JobId } from '@/platform/remote/comfyui/execution/types'
import type { JobDetail } from '@/platform/remote/comfyui/jobs/jobTypes'
import { useWorkflowStore } from '@/platform/workflow/management/stores/workflowStore'
import { api } from '@/scripts/api'
import { useExecutionStore } from '@/stores/executionStore'
import type { TaskItemImpl } from '@/stores/queueStore'
import { useQueueStore } from '@/stores/queueStore'

type TaskOutput = TaskItemImpl['outputs']

type JobOutcome =
  | { state: 'ended'; outputs?: TaskOutput }
  | { state: 'live' }
  | { state: 'unknown' }

const LIVE_STATUSES = new Set<JobDetail['status']>(['pending', 'in_progress'])
const ENDED_STATUSES = new Set<JobDetail['status']>([
  'completed',
  'failed',
  'cancelled'
])

const DETAIL_TIMEOUT_MS = 5_000
const DETAIL_RETRY_DELAY_MS = 1_000
const DETAIL_CONCURRENCY = 4
const MAX_UNREADABLE_REFRESHES = 3

/**
 * Returns the handler for the `reconnected` api event.
 */
export function useReconnectQueueRefresh() {
  const queueStore = useQueueStore()
  const executionStore = useExecutionStore()
  const workflowStore = useWorkflowStore()
  const detailRequests = new Semaphore(DETAIL_CONCURRENCY)
  const unreadableRefreshes = new Map<JobId, number>()
  let inFlight: Promise<void> | null = null
  let reconnects = 0

  function followedJobIds(): JobId[] {
    const ids = new Set<JobId>(Object.keys(executionStore.queuedJobs))
    if (executionStore.activeJobId) ids.add(executionStore.activeJobId)
    return [...ids]
  }

  async function fetchDetail(jobId: JobId): Promise<JobDetail | undefined> {
    await detailRequests.acquire()
    const request = new AbortController()
    try {
      return await withTimeout(
        () => api.getJobDetail(jobId, request.signal),
        DETAIL_TIMEOUT_MS
      )
    } catch {
      request.abort()
      return undefined
    } finally {
      detailRequests.release()
    }
  }

  function completedOutcome(
    detail: JobDetail | undefined,
    historyTask: TaskItemImpl | undefined
  ): JobOutcome {
    if (detail?.outputs) return { state: 'ended', outputs: detail.outputs }
    if (
      historyTask?.outputsCount === 1 &&
      historyTask.job.preview_output?.mediaType !== 'text'
    ) {
      return { state: 'ended', outputs: historyTask.outputs }
    }
    return { state: detail ? 'ended' : 'unknown' }
  }

  async function readOutcome(
    jobId: JobId,
    historyTask: TaskItemImpl | undefined
  ): Promise<JobOutcome> {
    const detail = await fetchDetail(jobId)
    const status = detail?.status ?? historyTask?.status
    if (status !== undefined && LIVE_STATUSES.has(status)) {
      return { state: 'live' }
    }
    if (status === undefined || !ENDED_STATUSES.has(status)) {
      return { state: 'unknown' }
    }
    if (status !== 'completed') return { state: 'ended' }
    return completedOutcome(detail, historyTask)
  }

  async function jobOutcome(
    jobId: JobId,
    historyTask: TaskItemImpl | undefined
  ): Promise<JobOutcome> {
    const outcome = await readOutcome(jobId, historyTask)
    if (outcome.state !== 'unknown') return outcome
    await delay(DETAIL_RETRY_DELAY_MS)
    return readOutcome(jobId, historyTask)
  }

  function jobWorkflowPath(jobId: JobId): string | undefined {
    return (
      executionStore.queuedJobs[jobId]?.workflow?.path ??
      executionStore.jobIdToSessionWorkflowPath.get(jobId)
    )
  }

  function ranOnOpenWorkflow(jobId: JobId): boolean {
    const path = jobWorkflowPath(jobId)
    return path === undefined || path === workflowStore.activeWorkflow?.path
  }

  function runsOnOpenGraph(runIds: Iterable<JobId>): boolean {
    return [...runIds].some(ranOnOpenWorkflow)
  }

  function stillFollowed(jobId: JobId): boolean {
    return (
      jobId in executionStore.queuedJobs || executionStore.activeJobId === jobId
    )
  }

  function replayOnOpenGraph(jobId: JobId, outputs: TaskOutput) {
    for (const [node, output] of Object.entries(outputs)) {
      api.dispatchCustomEvent('executed', {
        node,
        display_node: node,
        output,
        prompt_id: jobId
      })
    }
  }

  function keepWithBackgroundWorkflow(jobId: JobId, outputs: TaskOutput) {
    const changeTracker =
      executionStore.queuedJobs[jobId]?.workflow?.changeTracker
    if (!changeTracker) return
    changeTracker.nodeOutputs = { ...changeTracker.nodeOutputs, ...outputs }
  }

  function restoreOutputs(
    jobId: JobId,
    outputs: TaskOutput,
    openGraphTakenByOtherRun: boolean
  ) {
    if (!ranOnOpenWorkflow(jobId)) keepWithBackgroundWorkflow(jobId, outputs)
    else if (!openGraphTakenByOtherRun) replayOnOpenGraph(jobId, outputs)
  }

  function giveUpOnUnreadable(jobId: JobId): boolean {
    const refreshes = (unreadableRefreshes.get(jobId) ?? 0) + 1
    if (refreshes < MAX_UNREADABLE_REFRESHES) {
      unreadableRefreshes.set(jobId, refreshes)
      return false
    }
    unreadableRefreshes.delete(jobId)
    return true
  }

  async function refresh() {
    const followed = followedJobIds()
    const runsStartedDuringRefresh = new Set<JobId>()
    const stopWatchingActiveRun = watch(
      () => executionStore.activeJobId,
      (startedRun) => {
        if (startedRun) runsStartedDuringRefresh.add(startedRun)
      },
      { flush: 'sync' }
    )
    let outcomes: JobOutcome[]
    let leftQueue: JobId[]
    let activeJobIds: Set<JobId>
    try {
      await queueStore.updateFresh()
      activeJobIds = new Set([
        ...queueStore.runningTasks.map((t) => t.jobId),
        ...queueStore.pendingTasks.map((t) => t.jobId)
      ])
      leftQueue = followed.filter((jobId) => !activeJobIds.has(jobId))
      const historyByJobId = new Map(
        queueStore.historyTasks.map((task) => [task.jobId, task])
      )
      outcomes = await Promise.all(
        leftQueue.map((jobId) => jobOutcome(jobId, historyByJobId.get(jobId)))
      )
    } finally {
      stopWatchingActiveRun()
    }

    const currentRun = executionStore.activeJobId
    if (currentRun && runsStartedDuringRefresh.has(currentRun)) {
      activeJobIds.add(currentRun)
    }
    leftQueue.forEach((jobId, i) => {
      if (outcomes[i].state === 'live') activeJobIds.add(jobId)
    })
    const liveCurrentRun =
      currentRun && activeJobIds.has(currentRun) ? [currentRun] : []
    const openGraphTakenByOtherRun = runsOnOpenGraph([
      ...runsStartedDuringRefresh,
      ...liveCurrentRun
    ])

    const ended: JobId[] = []
    leftQueue.forEach((jobId, i) => {
      const outcome = outcomes[i]
      if (outcome.state === 'live') {
        unreadableRefreshes.delete(jobId)
        return
      }
      if (outcome.state === 'unknown') {
        if (giveUpOnUnreadable(jobId)) ended.push(jobId)
        return
      }
      unreadableRefreshes.delete(jobId)
      ended.push(jobId)
      if (outcome.outputs && stillFollowed(jobId)) {
        restoreOutputs(jobId, outcome.outputs, openGraphTakenByOtherRun)
      }
    })

    executionStore.clearActiveJobIfStale(activeJobIds)
    executionStore.forgetFinishedJobs(ended)
    for (const jobId of unreadableRefreshes.keys()) {
      if (!stillFollowed(jobId)) unreadableRefreshes.delete(jobId)
    }
  }

  async function refreshUntilSettled() {
    let handled: number
    do {
      handled = reconnects
      await refresh()
    } while (handled !== reconnects)
  }

  return async function refreshOnReconnect() {
    reconnects += 1
    if (inFlight) return inFlight
    inFlight = refreshUntilSettled().finally(() => {
      inFlight = null
    })
    return inFlight
  }
}
