import type { JobId } from '@/platform/remote/comfyui/execution/types'
import { useWorkflowStore } from '@/platform/workflow/management/stores/workflowStore'
import { api } from '@/scripts/api'
import { useExecutionStore } from '@/stores/executionStore'
import type { TaskItemImpl } from '@/stores/queueStore'
import { useQueueStore } from '@/stores/queueStore'

type TaskOutput = TaskItemImpl['outputs']

/**
 * After a WebSocket reconnect, refresh the queue from the server and clear
 * any job that finished during the disconnect window. Returns the handler so
 * the caller can wire it to the `reconnected` api event.
 *
 * `update()` preserves the previous queue snapshot when the fetch fails, so
 * if the network is still flaky we reconcile against the last known good
 * state rather than an empty (and falsely "stale") set.
 *
 * A run this tab was following that completed while the socket was down
 * never delivered its `executed` frames, so its outputs are replayed from the
 * server's record of the job (PM-2123).
 */
export function useReconnectQueueRefresh() {
  const queueStore = useQueueStore()
  const executionStore = useExecutionStore()
  const workflowStore = useWorkflowStore()

  function followedJobIds(): JobId[] {
    const ids = new Set<JobId>(Object.keys(executionStore.queuedJobs))
    if (executionStore.activeJobId) ids.add(executionStore.activeJobId)
    return [...ids]
  }

  /**
   * What the server says became of a followed job that left the queue: ended
   * or not (a just-submitted job can be missing from the queue snapshot) and,
   * if it completed, its outputs.
   */
  async function jobOutcome(
    jobId: JobId,
    historyTask: TaskItemImpl | undefined
  ): Promise<{ ended: boolean; outputs?: TaskOutput }> {
    const detail = await api.getJobDetail(jobId)
    const status = detail?.status ?? historyTask?.status
    const ended =
      status === 'completed' || status === 'failed' || status === 'cancelled'
    if (status !== 'completed') return { ended }
    if (detail) return { ended, outputs: detail.outputs }
    // Without the detail, the history row's preview is the whole output only
    // when the run is known to have produced exactly one.
    if (historyTask?.outputsCount !== 1) return { ended }
    return { ended, outputs: historyTask.outputs }
  }

  function replayOutputs(jobId: JobId, outputs: TaskOutput) {
    const workflow = executionStore.queuedJobs[jobId]?.workflow
    const path =
      workflow?.path ?? executionStore.jobIdToSessionWorkflowPath.get(jobId)
    // A job submitted elsewhere (the agent's own run tool) records no
    // workflow; its live frames would have landed on the open graph too.
    if (path === undefined || path === workflowStore.activeWorkflow?.path) {
      for (const [node, output] of Object.entries(outputs)) {
        api.dispatchCustomEvent('executed', {
          node,
          display_node: node,
          output,
          prompt_id: jobId
        })
      }
      return
    }
    // The run's workflow is in a background tab: keep the outputs with it,
    // as the live `executed` frame would, instead of painting the open graph.
    const changeTracker = workflow?.changeTracker
    if (!changeTracker) return
    changeTracker.nodeOutputs = { ...changeTracker.nodeOutputs, ...outputs }
  }

  return async function refreshOnReconnect() {
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

    // A run that started while the outcomes were being fetched is live: its
    // own frames own the canvas, and it is not stale.
    const startedRun = executionStore.activeJobId
    const newRunStarted = !!startedRun && !followed.includes(startedRun)
    if (newRunStarted) {
      activeJobIds.add(startedRun)
    } else {
      leftQueue.forEach((jobId, i) => {
        const { outputs } = outcomes[i]
        if (!outputs) return
        try {
          replayOutputs(jobId, outputs)
        } catch (error) {
          console.error(`Failed to restore outputs of job ${jobId}`, error)
        }
      })
    }

    executionStore.clearActiveJobIfStale(activeJobIds)
    executionStore.forgetFinishedJobs(
      leftQueue.filter((_, i) => outcomes[i].ended)
    )
  }
}
