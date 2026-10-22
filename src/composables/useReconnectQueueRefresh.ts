import { Semaphore, delay, withTimeout } from 'es-toolkit'

import { t } from '@/i18n'
import type {
  ExecutionError,
  JobDetail
} from '@/platform/remote/comfyui/jobs/jobTypes'
import { api } from '@/scripts/api'
import { useExecutionStore } from '@/stores/executionStore'
import type { TaskItemImpl } from '@/stores/queueStore'
import { useQueueStore } from '@/stores/queueStore'

type JobId = JobDetail['id']
type TaskOutput = TaskItemImpl['outputs']
type EndedStatus = Extract<
  JobDetail['status'],
  'completed' | 'failed' | 'cancelled'
>

type JobOutcome =
  | {
      state: 'ended'
      status: EndedStatus
      outputs?: TaskOutput
      executionError?: ExecutionError
      timestamp: number
    }
  | { state: 'live' }
  | { state: 'unknown' }

const LIVE_STATUSES = new Set<JobDetail['status']>(['pending', 'in_progress'])
const DETAIL_TIMEOUT_MS = 5_000
const DETAIL_RETRY_DELAY_MS = 1_000
const DETAIL_CONCURRENCY = 4
const MAX_UNREADABLE_REFRESHES = 3

function unknownExecutionError(): ExecutionError {
  return {
    node_id: '',
    node_type: '',
    exception_message: t('errorDialog.executionFailedWhileDisconnected'),
    exception_type: '',
    traceback: []
  }
}

/**
 * Returns the handler for the `reconnected` api event.
 */
export function useReconnectQueueRefresh() {
  const queueStore = useQueueStore()
  const executionStore = useExecutionStore()
  const detailRequests = new Semaphore(DETAIL_CONCURRENCY)
  const unreadableRefreshes = new Map<JobId, number>()
  let inFlight: Promise<void> | null = null
  let reconnects = 0

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

  function outcomeTimestamp(
    detail: JobDetail | undefined,
    historyTask: TaskItemImpl | undefined
  ) {
    const detailTimestamp = detail?.execution_end_time
    if (detailTimestamp != null) return detailTimestamp
    return historyTask?.executionEndTimestamp ?? Date.now()
  }

  function historyPreviewOutputs(historyTask: TaskItemImpl | undefined) {
    if (!historyTask || historyTask.outputsCount !== 1) return undefined
    if (historyTask.job.preview_output?.mediaType === 'text') return undefined
    return historyTask.outputs
  }

  function completedOutcome(
    detail: JobDetail | undefined,
    historyTask: TaskItemImpl | undefined
  ): JobOutcome {
    const outputs = detail?.outputs ?? historyPreviewOutputs(historyTask)
    if (!detail && !outputs) return { state: 'unknown' }
    return {
      state: 'ended',
      status: 'completed',
      outputs,
      timestamp: outcomeTimestamp(detail, historyTask)
    }
  }

  function nonCompletedOutcome(
    status: Exclude<EndedStatus, 'completed'>,
    detail: JobDetail | undefined,
    historyTask: TaskItemImpl | undefined
  ): JobOutcome {
    return {
      state: 'ended',
      status,
      executionError:
        detail?.execution_error ?? historyTask?.executionError ?? undefined,
      timestamp: outcomeTimestamp(detail, historyTask)
    }
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
    if (status === 'completed') return completedOutcome(detail, historyTask)
    if (status === 'failed' || status === 'cancelled') {
      return nonCompletedOutcome(status, detail, historyTask)
    }
    return { state: 'unknown' }
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

  function replayOutputs(jobId: JobId, outputs: TaskOutput) {
    for (const [node, output] of Object.entries(outputs)) {
      api.dispatchCustomEvent('executed', {
        node,
        display_node: node,
        output,
        prompt_id: jobId
      })
    }
  }

  function dispatchSuccess(jobId: JobId, timestamp: number) {
    api.dispatchCustomEvent('execution_success', {
      prompt_id: jobId,
      timestamp
    })
  }

  function dispatchInterrupted(
    jobId: JobId,
    timestamp: number,
    error: ExecutionError | undefined
  ) {
    api.dispatchCustomEvent('execution_interrupted', {
      prompt_id: jobId,
      timestamp,
      node_id: error?.node_id ?? '',
      node_type: error?.node_type ?? '',
      executed: error?.executed ?? []
    })
  }

  function dispatchError(
    jobId: JobId,
    timestamp: number,
    error: ExecutionError | undefined
  ) {
    const normalizedError = error ?? unknownExecutionError()
    api.dispatchCustomEvent('execution_error', {
      prompt_id: jobId,
      timestamp,
      node_id: normalizedError.node_id,
      node_type: normalizedError.node_type,
      executed: normalizedError.executed ?? [],
      exception_message: normalizedError.exception_message,
      exception_type: normalizedError.exception_type,
      traceback: normalizedError.traceback,
      current_inputs: normalizedError.current_inputs,
      current_outputs: normalizedError.current_outputs
    })
  }

  function dispatchTerminal(jobId: JobId, outcome: JobOutcome) {
    if (outcome.state !== 'ended') return
    if (outcome.status === 'completed') {
      dispatchSuccess(jobId, outcome.timestamp)
      return
    }

    const error = outcome.executionError
    if (
      outcome.status === 'cancelled' ||
      error?.exception_type === 'InterruptProcessingException'
    ) {
      dispatchInterrupted(jobId, outcome.timestamp, error)
      return
    }
    dispatchError(jobId, outcome.timestamp, error)
  }

  function isFollowed(jobId: JobId) {
    return (
      jobId in executionStore.queuedJobs || executionStore.activeJobId === jobId
    )
  }

  function replayOutcome(jobId: JobId, outcome: JobOutcome) {
    if (outcome.state !== 'ended' || !isFollowed(jobId)) return
    if (outcome.outputs) replayOutputs(jobId, outcome.outputs)
    dispatchTerminal(jobId, outcome)
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
    const followedIds = new Set(Object.keys(executionStore.queuedJobs))
    if (executionStore.activeJobId) {
      followedIds.add(executionStore.activeJobId)
    }
    const followed = [...followedIds]
    await queueStore.updateFresh()
    const activeJobIds = new Set([
      ...queueStore.runningTasks.map((t) => t.jobId),
      ...queueStore.pendingTasks.map((t) => t.jobId)
    ])
    const leftQueue = followed.filter((jobId) => !activeJobIds.has(jobId))
    const historyByJobId = new Map(
      queueStore.historyTasks.map((task) => [task.jobId, task])
    )
    const outcomes = await Promise.all(
      leftQueue.map((jobId) => jobOutcome(jobId, historyByJobId.get(jobId)))
    )

    const unreadable: JobId[] = []
    leftQueue.forEach((jobId, i) => {
      const outcome = outcomes[i]
      if (outcome.state === 'live') {
        activeJobIds.add(jobId)
        unreadableRefreshes.delete(jobId)
        return
      }
      if (outcome.state === 'unknown') {
        if (giveUpOnUnreadable(jobId)) unreadable.push(jobId)
        else if (historyByJobId.has(jobId)) activeJobIds.add(jobId)
        return
      }
      unreadableRefreshes.delete(jobId)
      replayOutcome(jobId, outcome)
    })

    const currentJobId = executionStore.activeJobId
    if (!currentJobId || followed.includes(currentJobId)) {
      executionStore.clearActiveJobIfStale(activeJobIds)
    }
    executionStore.forgetFinishedJobs(unreadable)
    for (const jobId of unreadableRefreshes.keys()) {
      if (!isFollowed(jobId)) unreadableRefreshes.delete(jobId)
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
