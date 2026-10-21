import { Semaphore, delay, withTimeout } from 'es-toolkit'

import type { JobId } from '@/platform/remote/comfyui/execution/types'
import type {
  ExecutionError,
  JobDetail
} from '@/platform/remote/comfyui/jobs/jobTypes'
import { api } from '@/scripts/api'
import { useExecutionStore } from '@/stores/executionStore'
import type { TaskItemImpl } from '@/stores/queueStore'
import { useQueueStore } from '@/stores/queueStore'

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

function isEndedStatus(
  status: JobDetail['status'] | undefined
): status is EndedStatus {
  return status === 'completed' || status === 'failed' || status === 'cancelled'
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
    const timestamp =
      detail?.execution_end_time ??
      historyTask?.executionEndTimestamp ??
      Date.now()
    if (detail?.outputs) {
      return {
        state: 'ended',
        status: 'completed',
        outputs: detail.outputs,
        timestamp
      }
    }
    if (
      historyTask?.outputsCount === 1 &&
      historyTask.job.preview_output?.mediaType !== 'text'
    ) {
      return {
        state: 'ended',
        status: 'completed',
        outputs: historyTask.outputs,
        timestamp
      }
    }
    return detail
      ? { state: 'ended', status: 'completed', timestamp }
      : { state: 'unknown' }
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
    if (!isEndedStatus(status)) {
      return { state: 'unknown' }
    }
    if (status !== 'completed') {
      return {
        state: 'ended',
        status,
        executionError:
          detail?.execution_error ?? historyTask?.executionError ?? undefined,
        timestamp:
          detail?.execution_end_time ??
          historyTask?.executionEndTimestamp ??
          Date.now()
      }
    }
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

  function stillFollowed(jobId: JobId): boolean {
    return (
      jobId in executionStore.queuedJobs || executionStore.activeJobId === jobId
    )
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

  function dispatchTerminal(jobId: JobId, outcome: JobOutcome) {
    if (outcome.state !== 'ended') return
    if (outcome.status === 'completed') {
      api.dispatchCustomEvent('execution_success', {
        prompt_id: jobId,
        timestamp: outcome.timestamp
      })
      return
    }

    const error = outcome.executionError
    if (
      outcome.status === 'cancelled' ||
      error?.exception_type === 'InterruptProcessingException'
    ) {
      api.dispatchCustomEvent('execution_interrupted', {
        prompt_id: jobId,
        timestamp: outcome.timestamp,
        node_id: error?.node_id ?? '',
        node_type: error?.node_type ?? '',
        executed: error?.executed ?? []
      })
      return
    }

    api.dispatchCustomEvent('execution_error', {
      prompt_id: jobId,
      timestamp: outcome.timestamp,
      node_id: error?.node_id ?? null,
      node_type: error?.node_type ?? '',
      executed: error?.executed ?? [],
      exception_message:
        error?.exception_message ??
        'The job failed while the live connection was unavailable.',
      exception_type: error?.exception_type ?? 'JobExecutionError',
      traceback: error?.traceback ?? [],
      current_inputs: error?.current_inputs,
      current_outputs: error?.current_outputs
    })
  }

  function replayOutcome(jobId: JobId, outcome: JobOutcome) {
    if (outcome.state !== 'ended' || !stillFollowed(jobId)) return
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
    const followed = followedJobIds()
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

    leftQueue.forEach((jobId, i) => {
      if (outcomes[i].state === 'live') activeJobIds.add(jobId)
    })

    const unreadable: JobId[] = []
    leftQueue.forEach((jobId, i) => {
      const outcome = outcomes[i]
      if (outcome.state === 'live') {
        unreadableRefreshes.delete(jobId)
        return
      }
      if (outcome.state === 'unknown') {
        if (giveUpOnUnreadable(jobId)) unreadable.push(jobId)
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
