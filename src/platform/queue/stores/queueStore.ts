import { defineStore } from 'pinia'
import { computed, ref, shallowRef, toValue } from 'vue'
import { TaskItemImpl } from '@comfyorg/api-client/jobs/taskItem'
import type { StatusWsMessageStatus } from '@comfyorg/api-client/executionTypes'
import { api } from '@/scripts/api'
import { useExecutionStore } from '@/stores/executionStore'
import { useJobModelDownloadStore } from '@/platform/queue/stores/jobModelDownloadStore'
import { useSettingStore } from '@/platform/settings/settingStore'
import { reportError } from '@comfyorg/telemetry/reportError'
export const useQueueStore = defineStore('queue', () => {
  const runningTasks = shallowRef<TaskItemImpl[]>([])
  const pendingTasks = shallowRef<TaskItemImpl[]>([])
  const historyTasks = shallowRef<TaskItemImpl[]>([])
  const hasFetchedHistorySnapshot = ref(false)
  const maxHistoryItems = ref(64)
  const isLoading = ref(false)
  const updateState = { inFlight: false, dirty: false }
  const hasDirtyUpdate = () => updateState.dirty
  const tasks = computed<TaskItemImpl[]>(
    () =>
      [
        ...pendingTasks.value,
        ...runningTasks.value,
        ...historyTasks.value
      ] as TaskItemImpl[]
  )
  const flatTasks = computed<TaskItemImpl[]>(() =>
    tasks.value.flatMap((task: TaskItemImpl) => task.flatten())
  )
  const lastJobHistoryPriority = computed<number>(() =>
    historyTasks.value.length ? historyTasks.value[0].job.priority : -1
  )
  const hasPendingTasks = computed<boolean>(() => pendingTasks.value.length > 0)
  const activeJobsCount = computed(
    () => pendingTasks.value.length + runningTasks.value.length
  )
  let currentUpdate: Promise<void> = Promise.resolve()
  const update = async () => {
    if (updateState.inFlight) {
      updateState.dirty = true
      return
    }
    currentUpdate = fetchQueueAndHistory()
    await currentUpdate
  }
  async function updateFresh() {
    if (!updateState.inFlight) return update()
    updateState.dirty = true
    await currentUpdate
    await currentUpdate
  }
  async function fetchQueueAndHistory() {
    updateState.inFlight = true
    updateState.dirty = false
    isLoading.value = true
    try {
      const [queueResult, historyResult] = await Promise.allSettled([
        api.getQueue({ throwOnError: true }),
        api.getHistory(maxHistoryItems.value, { throwOnError: true })
      ])
      if (queueResult.status === 'fulfilled') {
        const queue = queueResult.value
        runningTasks.value = queue.Running.map((job) => new TaskItemImpl(job))
        pendingTasks.value = queue.Pending.map((job) => new TaskItemImpl(job))
        const appearedTasks = [...pendingTasks.value, ...runningTasks.value]
        const executionStore = useExecutionStore()
        appearedTasks.forEach((task) => {
          const jobIdString = task.jobId
          const workflowId = task.workflowId
          if (workflowId && jobIdString) {
            executionStore.registerJobWorkflowIdMapping(jobIdString, workflowId)
          }
        })
        const activeJobIds = new Set([
          ...queue.Running.map((j) => j.id),
          ...queue.Pending.map((j) => j.id)
        ])
        executionStore.recordJobIdsAtLoad(activeJobIds)
        executionStore.reconcileInitializingJobs(activeJobIds)
        useJobModelDownloadStore().reconcileActiveJobs(activeJobIds)
      } else {
        console.error('Failed to fetch queue:', queueResult.reason)
      }
      if (historyResult.status === 'fulfilled') {
        const history = historyResult.value
        const currentHistory = toValue(historyTasks)
        const sortedHistory = [...history]
          .sort((a, b) => b.create_time - a.create_time)
          .slice(0, toValue(maxHistoryItems))
        const existingByJobId = new Map(
          currentHistory.map((impl) => [impl.jobId, impl])
        )
        const nextHistoryTasks = sortedHistory.map((job) => {
          const existing = existingByJobId.get(job.id)
          if (!existing) return new TaskItemImpl(job)
          if (
            existing.outputsCount !== (job.outputs_count ?? undefined) ||
            existing.previewableOutputsCount !==
              (job.previewable_outputs_count ?? undefined)
          ) {
            return new TaskItemImpl(job)
          }
          return existing
        })
        const isHistoryUnchanged =
          nextHistoryTasks.length === currentHistory.length &&
          nextHistoryTasks.every(
            (task, index) => task === currentHistory[index]
          )
        if (!isHistoryUnchanged) {
          historyTasks.value = nextHistoryTasks
        }
        hasFetchedHistorySnapshot.value = true
      } else {
        console.error('Failed to fetch history:', historyResult.reason)
      }
    } finally {
      isLoading.value = false
      updateState.inFlight = false
      if (hasDirtyUpdate()) {
        void update()
      }
    }
  }
  const clear = async (
    targets: ('queue' | 'history')[] = ['queue', 'history']
  ) => {
    const pendingJobIds = pendingTasks.value.map((task) => task.jobId)
    const results = await Promise.all(
      targets.map(async (type) => ({
        type,
        cleared: await api.clearItems(type)
      }))
    )
    if (results.some(({ type, cleared }) => type === 'queue' && cleared)) {
      useExecutionStore().clearInitializationByJobIds(pendingJobIds)
    }
    const failed = results.filter(({ cleared }) => !cleared)
    if (failed.length) {
      reportError('Failed to clear job lists', {
        errorType: 'error_clearing_job_lists',
        surface: 'platform',
        context: { targets: failed.map(({ type }) => type) }
      })
    }
    if (results.some(({ cleared }) => cleared)) await update()
    return failed.length === 0
  }
  const deleteTask = async (task: TaskItemImpl) => {
    await api.deleteItem(task.apiTaskType, task.jobId)
    await update()
  }
  return {
    runningTasks,
    pendingTasks,
    historyTasks,
    hasFetchedHistorySnapshot,
    maxHistoryItems,
    isLoading,
    tasks,
    flatTasks,
    lastJobHistoryPriority,
    hasPendingTasks,
    activeJobsCount,
    update,
    updateFresh,
    clear,
    delete: deleteTask
  }
})
export const useQueuePendingTaskCountStore = defineStore(
  'queuePendingTaskCount',
  {
    state: () => ({
      count: 0
    }),
    actions: {
      update(e: CustomEvent<StatusWsMessageStatus | null>) {
        const queueRemaining = e.detail?.exec_info?.queue_remaining
        if (queueRemaining != null) this.count = queueRemaining
      }
    }
  }
)
export const useQueueUIStore = defineStore('queueUIStore', () => {
  const settingStore = useSettingStore()
  const isOverlayExpanded = computed({
    get: () => settingStore.get('Comfy.Queue.History.Expanded'),
    set: (value) => settingStore.set('Comfy.Queue.History.Expanded', value)
  })
  function toggleOverlay() {
    isOverlayExpanded.value = !isOverlayExpanded.value
  }
  return { isOverlayExpanded, toggleOverlay }
})
