import type { JobId } from '@/platform/remote/comfyui/execution/types'
import { useWorkflowStore } from '@/platform/workflow/management/stores/workflowStore'
import { api } from '@/scripts/api'
import { useExecutionStore } from '@/stores/executionStore'
import type { TaskItemImpl } from '@/stores/queueStore'
import { useQueueStore } from '@/stores/queueStore'

type TaskOutput = TaskItemImpl['outputs']

interface JobOutcome {
  state: 'ended' | 'live' | 'unknown'
  outputs?: TaskOutput
}

const LIVE_STATUSES = new Set(['pending', 'in_progress'])

/**
 * After a WebSocket reconnect, refresh the queue, replay the outputs of
 * followed runs that completed while the socket was down, and clear the
 * runs that ended. Returns the handler for the `reconnected` api event.
 */
export function useReconnectQueueRefresh() {
  const queueStore = useQueueStore()
  const executionStore = useExecutionStore()
  const workflowStore = useWorkflowStore()
  let inFlight: Promise<void> | null = null

  function followedJobIds(): JobId[] {
    const ids = new Set<JobId>(Object.keys(executionStore.queuedJobs))
    if (executionStore.activeJobId) ids.add(executionStore.activeJobId)
    return [...ids]
  }

  async function jobOutcome(
    jobId: JobId,
    historyTask: TaskItemImpl | undefined
  ): Promise<JobOutcome> {
    const detail = await api.getJobDetail(jobId)
    const status = detail?.status ?? historyTask?.status
    if (status === undefined) return { state: 'unknown' }
    if (LIVE_STATUSES.has(status)) return { state: 'live' }
    if (status !== 'completed') return { state: 'ended' }
    if (detail?.outputs) return { state: 'ended', outputs: detail.outputs }
    if (historyTask?.outputsCount === 1) {
      return { state: 'ended', outputs: historyTask.outputs }
    }
    return { state: detail ? 'ended' : 'unknown' }
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
    openGraphTakenByNewRun: boolean
  ) {
    try {
      if (!ranOnOpenWorkflow(jobId)) keepWithBackgroundWorkflow(jobId, outputs)
      else if (!openGraphTakenByNewRun) replayOnOpenGraph(jobId, outputs)
    } catch (error) {
      console.error(`Failed to restore outputs of job ${jobId}`, error)
    }
  }

  async function refresh() {
    const followed = followedJobIds()
    await queueStore.update()
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

    const startedRun = executionStore.activeJobId
    const newRunStarted = !!startedRun && !followed.includes(startedRun)
    if (startedRun && newRunStarted) activeJobIds.add(startedRun)

    const ended: JobId[] = []
    leftQueue.forEach((jobId, i) => {
      const { state, outputs } = outcomes[i]
      if (state === 'live') activeJobIds.add(jobId)
      if (state !== 'ended') return
      ended.push(jobId)
      if (outputs) restoreOutputs(jobId, outputs, newRunStarted)
    })

    executionStore.clearActiveJobIfStale(activeJobIds)
    executionStore.forgetFinishedJobs(ended)
  }

  return async function refreshOnReconnect() {
    if (inFlight) return inFlight
    inFlight = refresh().finally(() => {
      inFlight = null
    })
    return inFlight
  }
}
