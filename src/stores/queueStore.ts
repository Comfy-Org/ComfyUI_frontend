import _ from 'es-toolkit/compat'
import { defineStore } from 'pinia'
import { computed, ref, shallowRef, toRaw, toValue } from 'vue'

import { reconcileJobs } from '@/platform/remote/comfyui/history/reconciliation'
import { extractWorkflow } from '@/platform/remote/comfyui/jobs/fetchJobs'
import type { JobListItem } from '@/platform/remote/comfyui/jobs/jobTypes'
import type { NodeId } from '@/platform/workflow/validation/schemas/workflowSchema'
import type {
  ResultItem,
  StatusWsMessageStatus,
  TaskOutput
} from '@/schemas/apiSchema'
import { api } from '@/scripts/api'
import type { ComfyApp } from '@/scripts/app'
import { useExtensionService } from '@/services/extensionService'
import { useNodeOutputStore } from '@/stores/imagePreviewStore'
import { useExecutionStore } from '@/stores/executionStore'
import { useJobOutputStore } from '@/stores/jobOutputStore'
import { getMediaTypeFromFilename } from '@/utils/formatUtil'

// Task type used in the API.
type APITaskType = 'queue' | 'history'

// Internal task type derived from job status
type TaskType = 'Running' | 'Pending' | 'History'

enum TaskItemDisplayStatus {
  Running = 'Running',
  Pending = 'Pending',
  Completed = 'Completed',
  Failed = 'Failed',
  Cancelled = 'Cancelled'
}

export class ResultItemImpl {
  filename: string
  subfolder: string
  type: string

  nodeId: NodeId
  // 'audio' | 'images' | ...
  mediaType: string

  // VHS output specific fields
  format?: string
  frame_rate?: number

  constructor(obj: Record<string, any>) {
    this.filename = obj.filename ?? ''
    this.subfolder = obj.subfolder ?? ''
    this.type = obj.type ?? ''

    this.nodeId = obj.nodeId
    this.mediaType = obj.mediaType

    this.format = obj.format
    this.frame_rate = obj.frame_rate
  }

  get urlParams(): URLSearchParams {
    const params = new URLSearchParams()
    params.set('filename', this.filename)
    params.set('type', this.type)
    params.set('subfolder', this.subfolder)

    if (this.format) {
      params.set('format', this.format)
    }
    if (this.frame_rate) {
      params.set('frame_rate', this.frame_rate.toString())
    }
    return params
  }

  /**
   * VHS advanced preview URL. `/viewvideo` endpoint is provided by VHS node.
   *
   * `/viewvideo` always returns a webm file.
   */
  get vhsAdvancedPreviewUrl(): string {
    return api.apiURL('/viewvideo?' + this.urlParams)
  }

  get url(): string {
    return api.apiURL('/view?' + this.urlParams)
  }

  get urlWithTimestamp(): string {
    return `${this.url}&t=${+new Date()}`
  }

  get isVhsFormat(): boolean {
    return !!this.format && !!this.frame_rate
  }

  get htmlVideoType(): string | undefined {
    if (this.isWebm) {
      return 'video/webm'
    }
    if (this.isMp4) {
      return 'video/mp4'
    }

    if (this.isVhsFormat) {
      if (this.format?.endsWith('webm')) {
        return 'video/webm'
      }
      if (this.format?.endsWith('mp4')) {
        return 'video/mp4'
      }
    }
    return undefined
  }

  get htmlAudioType(): string | undefined {
    if (this.isMp3) {
      return 'audio/mpeg'
    }
    if (this.isWav) {
      return 'audio/wav'
    }
    if (this.isOgg) {
      return 'audio/ogg'
    }
    if (this.isFlac) {
      return 'audio/flac'
    }
    return undefined
  }

  get isGif(): boolean {
    return this.filename.endsWith('.gif')
  }

  get isWebp(): boolean {
    return this.filename.endsWith('.webp')
  }

  get isWebm(): boolean {
    return this.filename.endsWith('.webm')
  }

  get isMp4(): boolean {
    return this.filename.endsWith('.mp4')
  }

  get isVideoBySuffix(): boolean {
    return this.isWebm || this.isMp4
  }

  get isImageBySuffix(): boolean {
    return this.isGif || this.isWebp
  }

  get isMp3(): boolean {
    return this.filename.endsWith('.mp3')
  }

  get isWav(): boolean {
    return this.filename.endsWith('.wav')
  }

  get isOgg(): boolean {
    return this.filename.endsWith('.ogg')
  }

  get isFlac(): boolean {
    return this.filename.endsWith('.flac')
  }

  get isAudioBySuffix(): boolean {
    return this.isMp3 || this.isWav || this.isOgg || this.isFlac
  }

  get isVideo(): boolean {
    const isVideoByType =
      this.mediaType === 'video' || !!this.format?.startsWith('video/')
    return (
      this.isVideoBySuffix ||
      (isVideoByType && !this.isImageBySuffix && !this.isAudioBySuffix)
    )
  }

  get isImage(): boolean {
    return (
      this.isImageBySuffix ||
      (this.mediaType === 'images' &&
        !this.isVideoBySuffix &&
        !this.isAudioBySuffix)
    )
  }

  get isAudio(): boolean {
    const isAudioByType =
      this.mediaType === 'audio' || !!this.format?.startsWith('audio/')
    return (
      this.isAudioBySuffix ||
      (isAudioByType && !this.isImageBySuffix && !this.isVideoBySuffix)
    )
  }

  get is3D(): boolean {
    return getMediaTypeFromFilename(this.filename) === '3D'
  }

  get supportsPreview(): boolean {
    return this.isImage || this.isVideo || this.isAudio || this.is3D
  }
}

export class TaskItemImpl {
  readonly job: JobListItem
  readonly outputs: TaskOutput
  readonly flatOutputs: ReadonlyArray<ResultItemImpl>

  constructor(
    job: JobListItem,
    outputs?: TaskOutput,
    flatOutputs?: ReadonlyArray<ResultItemImpl>
  ) {
    this.job = job
    // If no outputs provided but job has preview_output, create synthetic outputs
    const effectiveOutputs =
      outputs ??
      (job.preview_output
        ? { preview_node: { images: [job.preview_output] } }
        : {})
    // Remove animated outputs from the outputs object
    this.outputs = _.mapValues(effectiveOutputs, (nodeOutputs) =>
      _.omit(nodeOutputs, 'animated')
    )
    this.flatOutputs = flatOutputs ?? this.calculateFlatOutputs()
  }

  calculateFlatOutputs(): ReadonlyArray<ResultItemImpl> {
    if (!this.outputs) {
      return []
    }
    return Object.entries(this.outputs).flatMap(([nodeId, nodeOutputs]) =>
      Object.entries(nodeOutputs).flatMap(([mediaType, items]) =>
        (items as ResultItem[]).map(
          (item: ResultItem) =>
            new ResultItemImpl({
              ...item,
              nodeId,
              mediaType
            })
        )
      )
    )
  }

  get previewOutput(): ResultItemImpl | undefined {
    return (
      this.flatOutputs.find(
        // Prefer saved media files over the temp previews
        (output) => output.type === 'output' && output.supportsPreview
      ) ?? this.flatOutputs.find((output) => output.supportsPreview)
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
    return this.promptId + this.displayStatus
  }

  get queueIndex() {
    return this.job.priority
  }

  get promptId() {
    return this.job.id
  }

  get outputsCount(): number | undefined {
    return this.job.outputs_count ?? undefined
  }

  /**
   * The job status from the API
   */
  get status() {
    return this.job.status
  }

  /**
   * Error message if job failed.
   * Used by error reporting UI components.
   */
  get errorMessage(): string | undefined {
    return this.job.execution_error?.exception_message ?? undefined
  }

  /**
   * Execution error details if job failed with traceback.
   * Returns the error object for detailed error dialogs.
   */
  get executionError() {
    return this.job.execution_error ?? undefined
  }

  /**
   * Workflow ID if available from the job
   */
  get workflowId(): string | undefined {
    return this.job.workflow_id ?? undefined
  }

  /**
   * Full workflow data - not available in list response, use loadWorkflow()
   */
  get workflow(): undefined {
    return undefined
  }

  /**
   * Execution messages - not available in Jobs API
   */
  get messages(): Array<[string, unknown]> {
    return []
  }

  /**
   * Server-provided creation time in milliseconds
   */
  get createTime(): number {
    return this.job.create_time
  }

  /**
   * Whether the job was interrupted/cancelled
   */
  get interrupted(): boolean {
    return this.job.status === 'cancelled'
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
  public async loadFullOutputs(
    fetchApi: (url: string) => Promise<Response>
  ): Promise<TaskItemImpl> {
    // Only load for history tasks (caller checks outputsCount > 1)
    if (!this.isHistory) {
      return this
    }
    const jobOutputStore = useJobOutputStore()
    const jobDetail = await jobOutputStore.getJobDetail(fetchApi, this.promptId)

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
    const jobOutputStore = useJobOutputStore()
    const jobDetail = await jobOutputStore.getJobDetail(
      (url) => app.api.fetchApi(url),
      this.promptId
    )

    const workflowData = extractWorkflow(jobDetail)
    if (!workflowData) {
      return
    }

    await app.loadGraphData(toRaw(workflowData))

    // Use full outputs from job detail, or fall back to existing outputs
    const outputsToLoad = jobDetail?.outputs ?? this.outputs
    if (!outputsToLoad) {
      return
    }

    const nodeOutputsStore = useNodeOutputStore()
    const rawOutputs = toRaw(outputsToLoad)
    for (const nodeExecutionId in rawOutputs) {
      nodeOutputsStore.setNodeOutputsByExecutionId(
        nodeExecutionId,
        rawOutputs[nodeExecutionId]
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
      (output: ResultItemImpl, i: number) =>
        new TaskItemImpl(
          {
            ...this.job,
            id: `${this.promptId}-${i}`
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

  /**
   * Returns the underlying job data
   */
  public toJob(): JobListItem {
    return this.job
  }
}

export const useQueueStore = defineStore('queue', () => {
  // Use shallowRef because TaskItemImpl instances are immutable and arrays are
  // replaced entirely (not mutated), so deep reactivity would waste performance
  const runningTasks = shallowRef<TaskItemImpl[]>([])
  const pendingTasks = shallowRef<TaskItemImpl[]>([])
  const historyTasks = shallowRef<TaskItemImpl[]>([])
  const maxHistoryItems = ref(64)
  const isLoading = ref(false)

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

  const lastHistoryQueueIndex = computed<number>(() =>
    historyTasks.value.length ? historyTasks.value[0].queueIndex : -1
  )

  const hasPendingTasks = computed<boolean>(() => pendingTasks.value.length > 0)

  const update = async () => {
    isLoading.value = true
    try {
      const [queue, history] = await Promise.all([
        api.getQueue(),
        api.getHistory(maxHistoryItems.value)
      ])

      // API returns pre-sorted data (sort_by=create_time&order=desc)
      runningTasks.value = queue.Running.map((job) => new TaskItemImpl(job))
      pendingTasks.value = queue.Pending.map((job) => new TaskItemImpl(job))

      const currentHistory = toValue(historyTasks)

      const appearedTasks = [...pendingTasks.value, ...runningTasks.value]
      const executionStore = useExecutionStore()
      appearedTasks.forEach((task) => {
        const promptIdString = String(task.promptId)
        const workflowId = task.workflowId
        if (workflowId && promptIdString) {
          executionStore.registerPromptWorkflowIdMapping(
            promptIdString,
            workflowId
          )
        }
      })

      const reconciledJobs = reconcileJobs(
        history,
        currentHistory.map((impl) => impl.toJob()),
        toValue(maxHistoryItems)
      )

      // Reuse existing TaskItemImpl instances or create new
      const existingByPromptId = new Map(
        currentHistory.map((impl) => [impl.promptId, impl])
      )

      historyTasks.value = reconciledJobs.map(
        (job) => existingByPromptId.get(job.id) ?? new TaskItemImpl(job)
      )
    } finally {
      isLoading.value = false
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
    await api.deleteItem(task.apiTaskType, task.promptId)
    await update()
  }

  return {
    runningTasks,
    pendingTasks,
    historyTasks,
    maxHistoryItems,
    isLoading,

    tasks,
    flatTasks,
    lastHistoryQueueIndex,
    hasPendingTasks,

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
      update(e: CustomEvent<StatusWsMessageStatus>) {
        this.count = e.detail?.exec_info?.queue_remaining || 0
      }
    }
  }
)

export type AutoQueueMode = 'disabled' | 'instant' | 'change'

export const useQueueSettingsStore = defineStore('queueSettingsStore', {
  state: () => ({
    mode: 'disabled' as AutoQueueMode,
    batchCount: 1
  })
})
