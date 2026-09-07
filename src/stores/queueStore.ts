import { defineStore } from 'pinia'
import { computed, ref, shallowRef, toRaw, toValue } from 'vue'

import { extractWorkflow } from '@/platform/remote/comfyui/jobs/fetchJobs'
import type {
  APITaskType,
  JobListItem,
  TaskType
} from '@/platform/remote/comfyui/jobs/jobTypes'
import type { StatusWsMessageStatus, TaskOutput } from '@/schemas/apiSchema'
import { api } from '@/scripts/api'
import type { AugmentedResultItem } from '@/utils/resultItem'
import { filterPreviewableResults } from '@/utils/resultItem'
import { parseTaskOutput } from '@/stores/resultItemParsing'
import type { ComfyApp } from '@/scripts/app'
import { useExtensionService } from '@/services/extensionService'
import { getJobDetail } from '@/services/jobOutputCache'
import { useNodeOutputStore } from '@/stores/nodeOutputStore'
import { useExecutionStore } from '@/stores/executionStore'
import { tryNormalizeNodeExecutionId } from '@/types/nodeIdentification'
import { useSettingStore } from '@/platform/settings/settingStore'

enum TaskItemDisplayStatus {
  Running = 'Running',
  Pending = 'Pending',
  Completed = 'Completed',
  Failed = 'Failed',
  Cancelled = 'Cancelled'
}

export class TaskItemImpl {
  readonly job: JobListItem
  readonly outputs: TaskOutput
  readonly flatOutputs: ReadonlyArray<AugmentedResultItem>

  constructor(
    job: JobListItem,
    outputs?: TaskOutput,
    flatOutputs?: ReadonlyArray<AugmentedResultItem>
  ) {
    this.job = job
    // If no outputs provided but job has preview_output, create synthetic outputs
    // using the real nodeId and mediaType from the backend response
    const effectiveOutputs =
      outputs ??
      (job.preview_output
        ? {
            [job.preview_output.nodeId]: {
              [job.preview_output.mediaType]: [job.preview_output]
            }
          }
        : {})
    this.outputs = effectiveOutputs
    this.flatOutputs = flatOutputs ?? this.calculateFlatOutputs()
  }

  calculateFlatOutputs(): ReadonlyArray<AugmentedResultItem> {
    return parseTaskOutput(this.outputs)
  }

  /** All outputs that support preview (images, videos, audio, 3D, text) */
  get previewableOutputs(): readonly AugmentedResultItem[] {
    return filterPreviewableResults(this.flatOutputs)
  }

  get previewOutput(): AugmentedResultItem | undefined {
    const previewable = this.previewableOutputs
    // Prefer the last saved media file (most recent result) over temp previews
    return (
      previewable.findLast((output) => output.type === 'output') ??
      previewable.at(-1)
    )
  }

  // Derive taskType from job status
  get taskType(): TaskType {
    switch (this.job.status) {
      case 'in_progress':
        return 'Running'
      case 'pending':
        return 'Pending'
      default:
        return 'History'
    }
  }

  get apiTaskType(): APITaskType {
    switch (this.taskType) {
      case 'Running':
      case 'Pending':
        return 'queue'
      case 'History':
        return 'history'
    }
  }

  get key() {
    return this.jobId + this.displayStatus
  }

  get jobId() {
    return this.job.id
  }

  get outputsCount(): number | undefined {
    return this.job.outputs_count ?? undefined
  }

  /** Absent on backends or jobs that predate this field. */
  get previewableOutputsCount(): number | undefined {
    return this.job.previewable_outputs_count ?? undefined
  }

  get status() {
    return this.job.status
  }

  get errorMessage(): string | undefined {
    return this.job.execution_error?.exception_message ?? undefined
  }

  get executionError() {
    return this.job.execution_error ?? undefined
  }

  get workflowId(): string | undefined {
    return this.job.workflow_id ?? undefined
  }

  get createTime(): number {
    return this.job.create_time
  }

  get interrupted(): boolean {
    return (
      this.job.status === 'failed' &&
      this.job.execution_error?.exception_type ===
        'InterruptProcessingException'
    )
  }

  get isHistory() {
    return this.taskType === 'History'
  }

  get isRunning() {
    return this.taskType === 'Running'
  }

  get displayStatus(): TaskItemDisplayStatus {
    switch (this.job.status) {
      case 'in_progress':
        return TaskItemDisplayStatus.Running
      case 'pending':
        return TaskItemDisplayStatus.Pending
      case 'completed':
        return TaskItemDisplayStatus.Completed
      case 'failed':
        return TaskItemDisplayStatus.Failed
      case 'cancelled':
        return TaskItemDisplayStatus.Cancelled
    }
  }

  get executionStartTimestamp() {
    return this.job.execution_start_time ?? undefined
  }

  get executionEndTimestamp() {
    return this.job.execution_end_time ?? undefined
  }

  get executionTime() {
    if (!this.executionStartTimestamp || !this.executionEndTimestamp) {
      return undefined
    }
    return this.executionEndTimestamp - this.executionStartTimestamp
  }

  get executionTimeInSeconds() {
    return this.executionTime !== undefined
      ? this.executionTime / 1000
      : undefined
  }

  /**
   * Loads full outputs for tasks that only have preview data
   * Returns a new TaskItemImpl with full outputs and execution status
   */
  public async loadFullOutputs(): Promise<TaskItemImpl> {
    // Only load for history tasks (caller checks outputsCount > 1)
    if (!this.isHistory) {
      return this
    }
    const jobDetail = await getJobDetail(this.jobId)

    if (!jobDetail?.outputs) {
      return this
    }

    // Create new TaskItemImpl with full outputs
    return new TaskItemImpl(this.job, jobDetail.outputs)
  }

  public async loadWorkflow(app: ComfyApp) {
    if (!this.isHistory) {
      return
    }

    // Single fetch for both workflow and outputs (with caching)
    const jobDetail = await getJobDetail(this.jobId)

    const workflowData = await extractWorkflow(jobDetail)
    if (!workflowData) {
      return
    }

    await app.loadGraphData(toRaw(workflowData))

    // Use full outputs from job detail, or fall back to existing outputs
    const outputsToLoad = jobDetail?.outputs ?? this.outputs
    const nodeOutputsStore = useNodeOutputStore()
    const rawOutputs = toRaw(outputsToLoad)
    for (const rawNodeExecutionId in rawOutputs) {
      const nodeExecutionId = tryNormalizeNodeExecutionId(rawNodeExecutionId)
      if (!nodeExecutionId) continue
      nodeOutputsStore.setNodeOutputsByExecutionId(
        nodeExecutionId,
        rawOutputs[rawNodeExecutionId]
      )
    }
    useExtensionService().invokeExtensions(
      'onNodeOutputsUpdated',
      app.nodeOutputs
    )
  }

  public flatten(): TaskItemImpl[] {
    if (this.displayStatus !== TaskItemDisplayStatus.Completed) {
      return [this]
    }

    return this.flatOutputs.map(
      (output: AugmentedResultItem, i: number) =>
        new TaskItemImpl(
          {
            ...this.job,
            id: `${this.jobId}-${i}`
          },
          {
            [output.nodeId]: {
              [output.mediaType]: [output]
            }
          },
          [output]
        )
    )
  }
}

export const useQueueStore = defineStore('queue', () => {
  // Use shallowRef because TaskItemImpl instances are immutable and arrays are
  // replaced entirely (not mutated), so deep reactivity would waste performance
  const runningTasks = shallowRef<TaskItemImpl[]>([])
  const pendingTasks = shallowRef<TaskItemImpl[]>([])
  const historyTasks = shallowRef<TaskItemImpl[]>([])
  const hasFetchedHistorySnapshot = ref(false)
  const maxHistoryItems = ref(64)
  const isLoading = ref(false)

  // Single-flight coalescing: at most one fetch in flight at a time.
  // If update() is called while a fetch is running, the call is coalesced
  // and a single re-fetch fires after the current one completes.
  // This prevents both request spam and UI starvation (where a rapid stream
  // of calls causes every response to be discarded by a stale-request guard).
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

  const update = async () => {
    if (updateState.inFlight) {
      updateState.dirty = true
      return
    }

    updateState.inFlight = true
    updateState.dirty = false
    isLoading.value = true
    try {
      const [queueResult, historyResult] = await Promise.allSettled([
        api.getQueue({ throwOnError: true }),
        api.getHistory(maxHistoryItems.value)
      ])

      if (queueResult.status === 'fulfilled') {
        const queue = queueResult.value
        // API returns pre-sorted data (sort_by=create_time&order=desc)
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
        executionStore.reconcileInitializingJobs(activeJobIds)
      } else {
        console.error('Failed to fetch queue:', queueResult.reason)
      }

      if (historyResult.status === 'fulfilled') {
        const history = historyResult.value
        const currentHistory = toValue(historyTasks)

        // Sort by create_time descending and limit to maxItems
        const sortedHistory = [...history]
          .sort((a, b) => b.create_time - a.create_time)
          .slice(0, toValue(maxHistoryItems))

        // Reuse existing TaskItemImpl instances or create new
        // Must recreate if outputs_count changed (e.g., API started returning it)
        const existingByJobId = new Map(
          currentHistory.map((impl) => [impl.jobId, impl])
        )

        const nextHistoryTasks = sortedHistory.map((job) => {
          const existing = existingByJobId.get(job.id)
          if (!existing) return new TaskItemImpl(job)
          // Recreate if outputs_count changed to ensure lazy loading works
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
    if (targets.length === 0) {
      return
    }
    await Promise.all(targets.map((type) => api.clearItems(type)))
    await update()
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
        this.count = e.detail?.exec_info.queue_remaining || 0
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
