import { defineStore } from 'pinia'
import { computed, ref, shallowRef, toRaw, toValue } from 'vue'

import { extractWorkflow } from '@/platform/remote/comfyui/jobs/fetchJobs'
import type {
  APITaskType,
  JobListItem,
  TaskType
} from '@/platform/remote/comfyui/jobs/jobTypes'
import type { NodeId } from '@/platform/workflow/validation/schemas/workflowSchema'
import type {
  ResultItem,
  StatusWsMessageStatus,
  TaskOutput
} from '@/schemas/apiSchema'
import { appendCloudResParam } from '@/platform/distribution/cloudPreviewUtil'
import { api } from '@/scripts/api'
import { parseTaskOutput } from '@/stores/resultItemParsing'
import type { ComfyApp } from '@/scripts/app'
import { useExtensionService } from '@/services/extensionService'
import { getJobDetail } from '@/services/jobOutputCache'
import { useNodeOutputStore } from '@/stores/nodeOutputStore'
import { useExecutionStore } from '@/stores/executionStore'
import { useSettingStore } from '@/platform/settings/settingStore'
import { getMediaTypeFromFilename } from '@/utils/formatUtil'

enum TaskItemDisplayStatus {
  Running = 'Running',
  Pending = 'Pending',
  Completed = 'Completed',
  Failed = 'Failed',
  Cancelled = 'Cancelled'
}

interface ResultItemInit extends ResultItem {
  nodeId: NodeId
  mediaType: string
  format?: string
  frame_rate?: number
  display_name?: string
}

export class ResultItemImpl {
  filename: string
  subfolder: string
  type: string

  nodeId: NodeId
  // 'audio' | 'images' | ...
  mediaType: string

  display_name?: string

  // VHS output specific fields
  format?: string
  frame_rate?: number

  constructor(obj: ResultItemInit) {
    this.filename = obj.filename ?? ''
    this.subfolder = obj.subfolder ?? ''
    this.type = obj.type ?? ''

    this.nodeId = obj.nodeId
    this.mediaType = obj.mediaType

    this.display_name = obj.display_name

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

  get previewUrl(): string {
    if (!this.isImage) return this.url
    const params = new URLSearchParams(this.urlParams)
    appendCloudResParam(params, this.filename)
    return api.apiURL('/view?' + params)
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
    if (this.filename.endsWith('.mov')) {
      return 'video/quicktime'
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

  get isWebm(): boolean {
    return this.filename.endsWith('.webm')
  }

  get isMp4(): boolean {
    return this.filename.endsWith('.mp4')
  }

  get isVideoBySuffix(): boolean {
    return getMediaTypeFromFilename(this.filename) === 'video'
  }

  get isImageBySuffix(): boolean {
    return getMediaTypeFromFilename(this.filename) === 'image'
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
    return getMediaTypeFromFilename(this.filename) === 'audio'
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

  static filterPreviewable(
    outputs: readonly ResultItemImpl[]
  ): ResultItemImpl[] {
    return outputs.filter((o) => o.supportsPreview)
  }

  static findByUrl(items: readonly ResultItemImpl[], url?: string): number {
    if (!url) return 0
    const idx = items.findIndex((o) => o.url === url)
    return idx >= 0 ? idx : 0
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

  calculateFlatOutputs(): ReadonlyArray<ResultItemImpl> {
    if (!this.outputs) {
      return []
    }
    return parseTaskOutput(this.outputs)
  }

  /** All outputs that support preview (images, videos, audio, 3D) */
  get previewableOutputs(): readonly ResultItemImpl[] {
    return ResultItemImpl.filterPreviewable(this.flatOutputs)
  }

  get previewOutput(): ResultItemImpl | undefined {
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
  let inFlight = false
  let dirty = false

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
    if (inFlight) {
      dirty = true
      return
    }

    inFlight = true
    dirty = false
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
        const jobIdString = String(task.jobId)
        const workflowId = task.workflowId
        if (workflowId && jobIdString) {
          executionStore.registerJobWorkflowIdMapping(jobIdString, workflowId)
        }
      })

      // Only reconcile when the queue fetch returned data. api.getQueue()
      // returns empty Running/Pending on transient errors, which would
      // incorrectly clear all initializing prompts.
      const queueHasData = queue.Running.length > 0 || queue.Pending.length > 0
      if (queueHasData) {
        const activeJobIds = new Set([
          ...queue.Running.map((j) => j.id),
          ...queue.Pending.map((j) => j.id)
        ])
        executionStore.reconcileInitializingJobs(activeJobIds)
      }

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
        if (existing.outputsCount !== (job.outputs_count ?? undefined)) {
          return new TaskItemImpl(job)
        }
        return existing
      })

      const isHistoryUnchanged =
        nextHistoryTasks.length === currentHistory.length &&
        nextHistoryTasks.every((task, index) => task === currentHistory[index])

      if (!isHistoryUnchanged) {
        historyTasks.value = nextHistoryTasks
      }
      hasFetchedHistorySnapshot.value = true
    } finally {
      isLoading.value = false
      inFlight = false
      if (dirty) {
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
      update(e: CustomEvent<StatusWsMessageStatus>) {
        this.count = e.detail?.exec_info?.queue_remaining || 0
      }
    }
  }
)

export type AutoQueueMode =
  | 'disabled'
  | 'change'
  | 'instant-idle'
  | 'instant-running'

export const isInstantMode = (
  mode: AutoQueueMode
): mode is 'instant-idle' | 'instant-running' =>
  mode === 'instant-idle' || mode === 'instant-running'

export const isInstantRunningMode = (
  mode: AutoQueueMode
): mode is 'instant-running' => mode === 'instant-running'

export const useQueueSettingsStore = defineStore('queueSettingsStore', {
  state: () => ({
    mode: 'disabled' as AutoQueueMode,
    batchCount: 1
  })
})

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
