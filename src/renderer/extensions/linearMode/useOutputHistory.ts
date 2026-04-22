import { useAsyncState } from '@vueuse/core'
import type { ComputedRef } from 'vue'
import { computed, watchEffect } from 'vue'

import type { JobListItem } from '@/platform/remote/comfyui/jobs/jobTypes'
import { useWorkflowStore } from '@/platform/workflow/management/stores/workflowStore'
import { useLinearOutputStore } from '@/renderer/extensions/linearMode/linearOutputStore'
import { api } from '@/scripts/api'
import { useAppModeStore } from '@/stores/appModeStore'
import { useCommandStore } from '@/stores/commandStore'
import { useExecutionStore } from '@/stores/executionStore'
import {
  TaskItemImpl,
  useHistoryStore,
  useQueueStore
} from '@/stores/queueStore'
import type { ResultItemImpl } from '@/stores/queueStore'

export function useOutputHistory(): {
  outputs: ComputedRef<JobListItem[]>
  allOutputs: (item?: JobListItem) => readonly ResultItemImpl[]
  selectFirstHistory: () => void
  mayBeActiveWorkflowPending: ComputedRef<boolean>
  isWorkflowActive: ComputedRef<boolean>
  cancelActiveWorkflowJobs: () => Promise<void>
} {
  const linearStore = useLinearOutputStore()
  const workflowStore = useWorkflowStore()
  const executionStore = useExecutionStore()
  const appModeStore = useAppModeStore()
  const queueStore = useQueueStore()
  const historyStore = useHistoryStore()

  function matchesActiveWorkflow(task: { jobId: string | number }): boolean {
    const path = workflowStore.activeWorkflow?.path
    if (!path) return false
    return (
      executionStore.jobIdToSessionWorkflowPath.get(String(task.jobId)) === path
    )
  }

  function hasActiveWorkflowJobs(): boolean {
    if (!workflowStore.activeWorkflow?.path) return false
    return queueStore.runningTasks.some(matchesActiveWorkflow)
  }

  // True when there are queued/running jobs for the active workflow but no
  // in-progress output items yet.
  const mayBeActiveWorkflowPending = computed(() => {
    if (linearStore.activeWorkflowInProgressItems.length > 0) return false
    return hasActiveWorkflowJobs()
  })

  // True when the active workflow has running/pending jobs or in-progress items.
  const isWorkflowActive = computed(
    () =>
      linearStore.activeWorkflowInProgressItems.length > 0 ||
      hasActiveWorkflowJobs()
  )

  function filterByOutputNodes(
    items: readonly ResultItemImpl[]
  ): readonly ResultItemImpl[] {
    const nodeIds = appModeStore.selectedOutputs
    if (!nodeIds.length) return []
    return items.filter((r) =>
      nodeIds.some((id) => String(id) === String(r.nodeId))
    )
  }

  const sessionMedia = computed(() => {
    const path = workflowStore.activeWorkflow?.path
    if (!path) return []

    const pathMap = executionStore.jobIdToSessionWorkflowPath

    return historyStore.historyItems.filter(
      (item) => pathMap.get(item.id) === path
    )
  })

  const resolvedCache = linearStore.resolvedOutputsCache
  const asyncRefs = new Map<
    string,
    ReturnType<typeof useAsyncState<readonly ResultItemImpl[]>>['state']
  >()

  function allOutputs(item?: JobListItem): readonly ResultItemImpl[] {
    if (!item?.id) return []

    const cached = resolvedCache.get(item.id)
    if (cached) return filterByOutputNodes(cached)

    /*FIXME
    // For recently completed jobs still pending resolve, derive order from
    // the in-progress items which are in correct execution order.
    if (linearStore.pendingResolve.has(item.Id)) {
      const ordered = linearStore.inProgressItems
        .filter((i) => i.id === item.id && i.output)
        .map((i) => i.output!)
      if (ordered.length > 0) {
        resolvedCache.set(item.id, ordered)
        return filterByOutputNodes(ordered)
      }
    }*/

    // Async fallback for multi-output jobs — fetch full /jobs/{id} detail.
    // This can be hit if the user executes the job then switches tabs.
    const existing = asyncRefs.get(item.id)
    if (existing) return filterByOutputNodes(existing.value)

    const outputRef = useAsyncState(
      new TaskItemImpl(item)
        .loadFullOutputs()
        .then((item) => item.calculateFlatOutputs()),
      []
    ).state
    asyncRefs.set(item.id, outputRef)
    return filterByOutputNodes(outputRef.value)
  }

  function selectFirstHistory() {
    const first = historyStore.historyItems[0]
    if (first) {
      linearStore.selectAsLatest(`history:${first.id}:0`)
    } else {
      linearStore.selectAsLatest(null)
    }
  }

  // Resolve in-progress items when history outputs are loaded.
  watchEffect(() => {
    if (linearStore.pendingResolve.size === 0) return
    for (const jobId of linearStore.pendingResolve) {
      const job = historyStore.historyItems.find((j) => j.id === jobId)
      if (!job) continue
      const loaded = allOutputs(job).length > 0
      if (loaded) {
        linearStore.resolveIfReady(jobId, true)
        if (!linearStore.selectedId) selectFirstHistory()
      }
    }
  })

  async function cancelActiveWorkflowJobs() {
    if (!workflowStore.activeWorkflow?.path) return

    // Interrupt the running job if it belongs to this workflow
    if (queueStore.runningTasks.some(matchesActiveWorkflow)) {
      void useCommandStore().execute('Comfy.Interrupt')
    } else {
      // Delete first pending job for this workflow from the queue
      for (const task of queueStore.pendingTasks) {
        if (matchesActiveWorkflow(task)) {
          await api.deleteItem('queue', String(task.jobId))
          break
        }
      }
    }
  }

  return {
    outputs: sessionMedia,
    allOutputs,
    selectFirstHistory,
    mayBeActiveWorkflowPending,
    isWorkflowActive,
    cancelActiveWorkflowJobs
  }
}
