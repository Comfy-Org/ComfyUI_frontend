import { createEventHook } from '@vueuse/core'
import { defineStore } from 'pinia'
import { computed, ref, shallowRef, watch } from 'vue'

import { useAppMode } from '@/composables/useAppMode'
import { isCloud } from '@/platform/distribution/types'
import { resolveAccountPrecondition } from '@/platform/workflowErrors/errorCatalog/accountPreconditionRouting'
import { useTelemetry } from '@comfyorg/telemetry'
import { reportError } from '@comfyorg/telemetry/reportError'
import type {
  WorkflowExecutionContext,
  WorkflowExecutionFailureReason,
  WorkflowExecutionIntent
} from '@comfyorg/telemetry/types'
import type { ComfyWorkflow } from '@/platform/workflow/management/stores/workflowStore'
import { useWorkflowStore } from '@/platform/workflow/management/stores/workflowStore'
import type {
  ComfyApiWorkflow,
  WorkflowId
} from '@comfyorg/graph-model/workflowSchema'
import type {
  ExecutedWsMessage,
  ExecutionCachedWsMessage,
  ExecutionErrorWsMessage,
  ExecutionInterruptedWsMessage,
  ExecutionStartWsMessage,
  ExecutionSuccessWsMessage,
  JobId,
  NodeProgressState,
  NotificationWsMessage,
  ProgressStateWsMessage,
  ProgressWsMessage
} from '@comfyorg/api-client/executionTypes'
import type { zPromptOutputsSkippedData } from '@comfyorg/ingest-types/zod'
import type { NodeError } from '@comfyorg/api-client/types'
import { api } from '@/scripts/api'
import { useApp } from '@/scripts/appInstance'
import { useNodeOutputStore } from '@/stores/nodeOutputStore'
import { useExtensionServiceAccess } from '@/platform/extensions/services/extensionServiceAccess'
import { useJobPreviewStore } from '@/stores/jobPreviewStore'
import { useExecutionErrorStore } from '@/stores/executionErrorStore'
import { tryNormalizeNodeExecutionId } from '@comfyorg/graph-model/nodeIdentification'
import type { NodeLocatorId } from '@comfyorg/graph-model/nodeIdentification'
import type { AppMode } from '@comfyorg/graph-model/appMode'
import { isAppModeValue } from '@comfyorg/graph-model/appMode'
import { zeroUuid } from '@comfyorg/graph-model/uuid'
import {
  classifyCloudValidationError,
  normalizeRelayedNodeErrors
} from '@/utils/executionErrorUtil'
import { executionIdToNodeLocatorId } from '@/utils/graphTraversalUtil'
import { mergeNodeOutput } from '@/utils/nodeOutputUtil'
import { createRafCoalescer } from '@/utils/rafBatch'
import { zComfyApiWorkflow } from '@comfyorg/graph-model/workflowSchema'
import { zQueueInfo } from '@comfyorg/ingest-types/zod'
import type { z } from 'zod'

type PromptOutputsSkippedData = z.infer<typeof zPromptOutputsSkippedData>

const zRunningQueue = zQueueInfo.pick({ queue_running: true })

function findRunningPrompt(
  body: unknown,
  jobId: string
): ComfyApiWorkflow | undefined {
  const queue = zRunningQueue.safeParse(body)
  if (!queue.success) return
  const item = queue.data.queue_running?.find((entry) => entry[1] === jobId)
  const prompt = zComfyApiWorkflow.safeParse(item?.[2])
  return prompt.success ? prompt.data : undefined
}

type RuntimeExecutionError = Omit<
  ExecutionErrorWsMessage,
  'node_id' | 'traceback'
> & {
  node_id?: ExecutionErrorWsMessage['node_id'] | null
  traceback?: ExecutionErrorWsMessage['traceback'] | null
}

interface ExecutionNodeInfo {
  title?: string | null
  type?: string | null
}

export interface QueuedJob {
  /**
   * The nodes that are queued to be executed. The key is the node id and the
   * value is a boolean indicating if the node has been executed.
   */
  nodes: Record<string, boolean>
  startTime?: number
  submissionAcceptedAt?: number
  executionStartedAt?: number
  /** Epoch ms from the execution_start message. */
  executionStartedAtWallMs?: number
  outcomeTracked?: boolean
  workflowContext?: WorkflowExecutionContext
  workflowExecutionIntent?: WorkflowExecutionIntent
  /**
   * The workflow that is queued to be executed
   */
  workflow?: ComfyWorkflow
  /**
   * Queue-time node metadata keyed by execution ID.
   * This stays stable even if the user switches workflows or edits the canvas.
   */
  nodeLookup?: Record<string, ExecutionNodeInfo>
  outputs?: Partial<Record<string, ExecutedWsMessage['output']>>
  /**
   * Share attribution snapshotted at queue time. Read this instead of
   * `workflow.shareId`, which can gain attribution after the job was queued.
   */
  shareId?: string
  /**
   * View-mode attribution snapshotted at queue time, so mode switches during
   * the run don't misattribute completion events.
   */
  viewMode?: AppMode
  isAppMode?: boolean
}

const defaultWorkflowExecutionIntent: WorkflowExecutionIntent = {
  trigger_source: 'unknown'
}

function findRunningNode(nodes: Record<string, NodeProgressState>) {
  return Object.entries(nodes).find(([, node]) => node.state === 'running')
}

function startedJobIdsByStart(jobs: Record<JobId, QueuedJob>): JobId[] {
  return Object.entries(jobs)
    .filter(([, job]) => job.executionStartedAt !== undefined)
    .sort(
      ([, a], [, b]) =>
        (a.executionStartedAt ?? 0) - (b.executionStartedAt ?? 0)
    )
    .map(([jobId]) => jobId)
}

function buildExecutionNodeLookup(
  promptOutput: ComfyApiWorkflow
): Record<string, ExecutionNodeInfo> {
  return Object.fromEntries(
    Object.entries(promptOutput).map(([executionId, node]) => [
      executionId,
      {
        title: node._meta?.title ?? node.class_type,
        type: node.class_type
      }
    ])
  )
}

/**
 * Maximum number of job entries retained in {@link nodeProgressStatesByJob}.
 * When exceeded, the oldest entries (by insertion order) are evicted to
 * prevent unbounded memory growth in long-running sessions.
 */
export const MAX_PROGRESS_JOBS = 1000

export type WorkflowExecutionStatus = 'running' | 'completed' | 'failed'

interface WorkflowStatusUpdate {
  status: WorkflowExecutionStatus
  executionStartedAt?: number
  endTime?: number
  failureReason?: WorkflowExecutionFailureReason
  showStatus?: boolean
}

interface PendingExecutionError {
  detail: ExecutionErrorWsMessage
  endTime: number
}

export const WORKFLOW_STATUS_I18N_KEYS: Record<
  WorkflowExecutionStatus,
  string
> = {
  running: 'g.running',
  completed: 'g.completed',
  failed: 'g.failed'
}

export const useExecutionStore = defineStore('execution', () => {
  const workflowStore = useWorkflowStore()
  const executionErrorStore = useExecutionErrorStore()
  const { mode, isAppMode } = useAppMode()

  const clientId = ref<string | null>(null)
  const activeJobId = ref<JobId | null>(null)
  const queuedJobs = ref<Record<JobId, QueuedJob>>({})
  const jobReset = createEventHook<QueuedJob>()
  // This is the progress of all nodes in the currently executing workflow
  const nodeProgressStates = ref<Record<string, NodeProgressState>>({})
  const nodeProgressStatesByJob = ref<
    Record<JobId, Record<string, NodeProgressState>>
  >({})

  /**
   * Map of job ID to workflow ID for quick lookup across the app.
   */
  const jobIdToWorkflowId = ref<Map<JobId, WorkflowId>>(new Map())

  /**
   * Map of job ID to workflow file path in the current session.
   * Only populated for jobs that are queued in this browser tab.
   */
  const jobIdToSessionWorkflowPath = shallowRef<Map<JobId, string>>(new Map())
  const jobIdToWorkflowInstanceId = new Map<JobId, string>()

  const jobIdToStampedWorkflowId = new Map<JobId, string>()
  const MAX_STAMPED_WORKFLOW_ID_ENTRIES = 4000
  let jobIdsAtLoad: Set<JobId> | undefined

  const initializingJobIds = ref<Set<JobId>>(new Set())

  const workflowStatus = shallowRef<
    Map<ComfyWorkflow, WorkflowExecutionStatus>
  >(new Map())

  const jobIdToWorkflow = new Map<string, ComfyWorkflow>()

  // Buffers statuses arriving before storeJob attaches the workflow.
  // FIFO-capped to bound growth if a matching storeJob never fires.
  const pendingWorkflowStatusByJobId = new Map<string, WorkflowStatusUpdate>()
  const pendingExecutionErrorsByJobId = new Map<string, PendingExecutionError>()
  const pendingSkippedOutputsByJobId = new Map<
    string,
    Record<string, NodeError>
  >()

  function bufferPendingWorkflowStatus(
    jobId: string,
    update: WorkflowStatusUpdate
  ) {
    const existing = pendingWorkflowStatusByJobId.get(jobId)
    const executionStartedAt =
      update.executionStartedAt ??
      queuedJobs.value[jobId]?.executionStartedAt ??
      existing?.executionStartedAt
    pendingWorkflowStatusByJobId.delete(jobId)
    pendingWorkflowStatusByJobId.set(jobId, {
      ...update,
      ...(executionStartedAt !== undefined && { executionStartedAt })
    })
    while (pendingWorkflowStatusByJobId.size > MAX_PROGRESS_JOBS) {
      const oldest = pendingWorkflowStatusByJobId.keys().next().value
      if (oldest === undefined) break
      pendingWorkflowStatusByJobId.delete(oldest)
    }
  }

  function bufferByJobId<T>(buffer: Map<string, T>, jobId: string, value: T) {
    buffer.delete(jobId)
    buffer.set(jobId, value)
    while (buffer.size > MAX_PROGRESS_JOBS) {
      const oldest = buffer.keys().next().value
      if (oldest === undefined) break
      buffer.delete(oldest)
    }
  }

  function bufferPendingExecutionError(error: PendingExecutionError) {
    bufferByJobId(pendingExecutionErrorsByJobId, error.detail.prompt_id, error)
  }

  function mutateStatus(
    mutator: (map: Map<ComfyWorkflow, WorkflowExecutionStatus>) => void
  ) {
    const next = new Map(workflowStatus.value)
    mutator(next)
    workflowStatus.value = next
  }

  function applyWorkflowStatus(
    workflow: ComfyWorkflow,
    status: WorkflowExecutionStatus
  ) {
    // A late terminal event can arrive after the tab closed; don't resurrect
    // an entry (which also pins the workflow ref) for a closed workflow.
    if (!workflowStore.isOpen(workflow)) return
    mutateStatus((m) => m.set(workflow, status))
  }

  function trackExecutionOutcome(
    jobId: string,
    { status, endTime, failureReason }: WorkflowStatusUpdate
  ) {
    if (status === 'running' || endTime === undefined) return
    if (!(jobId in queuedJobs.value)) return
    const queuedJob = queuedJobs.value[jobId]
    const startTime = queuedJob.startTime
    const workflowExecutionIntent = queuedJob.workflowExecutionIntent
    if (
      queuedJob.outcomeTracked ||
      startTime === undefined ||
      workflowExecutionIntent === undefined
    )
      return

    queuedJob.outcomeTracked = true
    const metadata = {
      startTime,
      ...workflowExecutionIntent,
      ...(queuedJob.submissionAcceptedAt !== undefined && {
        submissionAcceptedAt: queuedJob.submissionAcceptedAt
      }),
      ...(queuedJob.executionStartedAt !== undefined && {
        executionStartedAt: queuedJob.executionStartedAt
      }),
      endTime,
      ...(queuedJob.workflowContext && {
        workflowContext: queuedJob.workflowContext
      })
    }
    const telemetry = useTelemetry()
    if (status === 'completed') {
      telemetry?.trackExecutionOutcome({
        ...metadata,
        success: true,
        failureReason: ''
      })
      return
    }
    telemetry?.trackExecutionOutcome({
      ...metadata,
      success: false,
      failureReason: failureReason ?? 'execution_failed'
    })
  }

  function setWorkflowStatus(jobId: string, update: WorkflowStatusUpdate) {
    const workflow = jobIdToWorkflow.get(jobId)
    if (!workflow) {
      bufferPendingWorkflowStatus(jobId, update)
      return
    }
    if (update.showStatus !== false) {
      applyWorkflowStatus(workflow, update.status)
    }
    trackExecutionOutcome(jobId, update)
  }

  function clearWorkflowStatus(workflow: ComfyWorkflow) {
    if (!workflowStatus.value.has(workflow)) return
    mutateStatus((m) => m.delete(workflow))
  }

  function getWorkflowStatus(
    workflow: ComfyWorkflow | undefined | null
  ): WorkflowExecutionStatus | undefined {
    if (!workflow) return undefined
    return workflowStatus.value.get(workflow)
  }

  // Prune statuses for workflows that have been closed.
  watch(
    () => workflowStore.openWorkflows,
    (openWorkflows) => {
      if (workflowStatus.value.size === 0) return
      const openSet = new Set(openWorkflows)
      const filtered = new Map(
        [...workflowStatus.value].filter(([w]) => openSet.has(w))
      )
      if (filtered.size !== workflowStatus.value.size) {
        workflowStatus.value = filtered
      }
    }
  )

  /**
   * Cache for executionIdToNodeLocatorId lookups.
   * Avoids redundant graph traversals during a single execution run.
   * Cleared at execution start and end to ensure fresh graph state.
   */
  const executionIdToLocatorCache = new Map<string, NodeLocatorId | undefined>()

  function cachedExecutionIdToLocator(
    executionId: string
  ): NodeLocatorId | undefined {
    if (executionIdToLocatorCache.has(executionId)) {
      return executionIdToLocatorCache.get(executionId)
    }
    const locatorId = executionIdToNodeLocatorId(
      useApp().rootGraph,
      executionId
    )
    executionIdToLocatorCache.set(executionId, locatorId)
    return locatorId
  }

  const mergeExecutionProgressStates = (
    currentState: NodeProgressState | undefined,
    newState: NodeProgressState
  ): NodeProgressState => {
    if (currentState === undefined) {
      return newState
    }

    const mergedState = { ...currentState }
    if (mergedState.state === 'error') {
      return mergedState
    } else if (newState.state === 'running') {
      const newPerc = newState.max > 0 ? newState.value / newState.max : 0.0
      const oldPerc =
        mergedState.max > 0 ? mergedState.value / mergedState.max : 0.0
      if (
        mergedState.state !== 'running' ||
        oldPerc === 0.0 ||
        newPerc < oldPerc
      ) {
        mergedState.value = newState.value
        mergedState.max = newState.max
      }
      mergedState.state = 'running'
    }

    return mergedState
  }

  const nodeLocationProgressStates = computed<
    Record<NodeLocatorId, NodeProgressState>
  >(() => {
    const result: Record<NodeLocatorId, NodeProgressState> = {}

    const states = nodeProgressStates.value // Apparently doing this inside `Object.entries` causes issues
    for (const state of Object.values(states)) {
      const parts = String(state.display_node_id).split(':')
      for (let i = 0; i < parts.length; i++) {
        const executionId = parts.slice(0, i + 1).join(':')
        const locatorId = cachedExecutionIdToLocator(executionId)
        if (!locatorId) continue

        result[locatorId] = mergeExecutionProgressStates(
          result[locatorId],
          state
        )
      }
    }

    return result
  })

  // Easily access all currently executing node IDs
  const executingNodeIds = computed<string[]>(() => {
    return Object.entries(nodeProgressStates.value)
      .filter(([_, state]) => state.state === 'running')
      .map(([nodeId, _]) => nodeId)
  })

  // @deprecated For backward compatibility - stores the primary executing node ID
  const executingNodeId = computed<string | null>(() => {
    return executingNodeIds.value[0] ?? null
  })

  const uniqueExecutingNodeIdStrings = computed(
    () => new Set(executingNodeIds.value.map(String))
  )

  // For backward compatibility - returns the primary executing node info
  const executingNode = computed<ExecutionNodeInfo | null>(() => {
    if (!executingNodeId.value) return null

    return activeJob.value?.nodeLookup?.[executingNodeId.value] ?? null
  })

  // This is the progress of the currently executing node (for backward compatibility)
  const progressByJob = ref<Record<JobId, ProgressWsMessage>>({})
  const _executingNodeProgress = computed<ProgressWsMessage | null>(() =>
    activeJobId.value ? (progressByJob.value[activeJobId.value] ?? null) : null
  )
  const executingNodeProgress = computed(() =>
    activeJobId.value ? executingNodeProgressForJob(activeJobId.value) : null
  )

  const activeJob = computed<QueuedJob | undefined>(
    () => queuedJobs.value[activeJobId.value ?? '']
  )

  const isIdle = computed<boolean>(() => !activeJobId.value)

  function executionProgressForJob(jobId: JobId): number {
    const job = Object.hasOwn(queuedJobs.value, jobId)
      ? queuedJobs.value[jobId]
      : undefined
    const done = job?.nodeLookup ? Object.values(job.nodes) : []
    if (done.length > 0) return done.filter(Boolean).length / done.length
    const states = Object.values(nodeProgressStatesByJob.value[jobId] ?? {})
    if (states.length === 0) return 0
    return states.filter((n) => n.state === 'finished').length / states.length
  }

  function executingNodeForJob(jobId: JobId): ExecutionNodeInfo | null {
    const nodeId = findRunningNode(
      nodeProgressStatesByJob.value[jobId] ?? {}
    )?.[0]
    if (!nodeId || !Object.hasOwn(queuedJobs.value, jobId)) return null
    return queuedJobs.value[jobId].nodeLookup?.[nodeId] ?? null
  }

  function executingNodeProgressForJob(jobId: JobId): number | null {
    if (!Object.hasOwn(progressByJob.value, jobId)) return null
    const progress = progressByJob.value[jobId]
    return progress.value / progress.max
  }

  const executionProgress = computed<number>(() =>
    activeJobId.value ? executionProgressForJob(activeJobId.value) : 0
  )

  function bindExecutionEvents() {
    api.addEventListener('notification', handleNotification)
    api.addEventListener('execution_start', handleExecutionStart)
    api.addEventListener('execution_cached', handleExecutionCached)
    api.addEventListener('execution_interrupted', handleExecutionInterrupted)
    api.addEventListener('execution_success', handleExecutionSuccess)
    api.addEventListener('executed', handleExecuted)
    api.addEventListener('progress', handleProgress)
    api.addEventListener('progress_state', handleProgressState)
    api.addEventListener('status', handleStatus)
    api.addEventListener('execution_error', handleExecutionError)
    api.addEventListener('prompt_outputs_skipped', handlePromptOutputsSkipped)
  }

  function unbindExecutionEvents() {
    api.removeEventListener('notification', handleNotification)
    api.removeEventListener('execution_start', handleExecutionStart)
    api.removeEventListener('execution_cached', handleExecutionCached)
    api.removeEventListener('execution_interrupted', handleExecutionInterrupted)
    api.removeEventListener('execution_success', handleExecutionSuccess)
    api.removeEventListener('executed', handleExecuted)
    api.removeEventListener('progress', handleProgress)
    api.removeEventListener('progress_state', handleProgressState)
    api.removeEventListener('status', handleStatus)
    api.removeEventListener('execution_error', handleExecutionError)
    api.removeEventListener(
      'prompt_outputs_skipped',
      handlePromptOutputsSkipped
    )

    if (workflowStatus.value.size > 0) workflowStatus.value = new Map()
    pendingWorkflowStatusByJobId.clear()
    pendingExecutionErrorsByJobId.clear()
    pendingSkippedOutputsByJobId.clear()
    jobIdToWorkflow.clear()
    jobIdToStampedWorkflowId.clear()

    cancelPendingProgressUpdates()
  }

  function routableWorkflowId(id: string | undefined): string | undefined {
    return !id || id === zeroUuid ? undefined : id
  }

  function rememberStampedWorkflowId(
    jobId: JobId,
    workflowId: string | undefined
  ): void {
    const stamped = routableWorkflowId(workflowId)
    if (!stamped || jobIdToStampedWorkflowId.has(jobId)) return
    jobIdToStampedWorkflowId.set(jobId, stamped)
    while (jobIdToStampedWorkflowId.size > MAX_STAMPED_WORKFLOW_ID_ENTRIES) {
      const oldest = jobIdToStampedWorkflowId.keys().next().value
      if (oldest === undefined) break
      jobIdToStampedWorkflowId.delete(oldest)
    }
  }

  function ownershipByInstance(
    jobId: JobId,
    activeWorkflow: ComfyWorkflow
  ): boolean | undefined {
    const ownerInstanceId = jobIdToWorkflowInstanceId.get(jobId)
    if (!ownerInstanceId || !activeWorkflow.instanceId) return
    return ownerInstanceId === activeWorkflow.instanceId
  }

  function ownershipByPath(
    jobId: JobId,
    activeWorkflow: ComfyWorkflow
  ): boolean | undefined {
    const ownerPath = jobIdToSessionWorkflowPath.value.get(jobId)
    if (!ownerPath || !activeWorkflow.path) return
    return ownerPath === activeWorkflow.path
  }

  function recordJobIdsAtLoad(jobIds: Iterable<JobId>) {
    jobIdsAtLoad ??= new Set(jobIds)
  }

  function predatesLoad(jobId: JobId): boolean {
    return !jobIdsAtLoad || jobIdsAtLoad.has(jobId)
  }

  function ownershipByWorkflowId(
    jobId: JobId,
    activeWorkflow: ComfyWorkflow,
    workflowId: string | undefined
  ): boolean | undefined {
    if (!predatesLoad(jobId)) return
    const activeGraphId = routableWorkflowId(
      activeWorkflow.activeState?.id ?? activeWorkflow.initialState?.id
    )
    const frameWorkflowId =
      routableWorkflowId(workflowId) ?? jobIdToStampedWorkflowId.get(jobId)
    if (!frameWorkflowId || !activeGraphId) return
    return frameWorkflowId === activeGraphId
  }

  function rememberStampAndCheckActiveWorkflow(
    jobId: JobId | undefined,
    workflowId?: string
  ): boolean {
    if (!jobId) return false
    rememberStampedWorkflowId(jobId, workflowId)
    const activeWorkflow = workflowStore.activeWorkflow
    if (!activeWorkflow) return false
    return isJobOwnedBy(jobId, activeWorkflow, workflowId)
  }

  function isJobOwnedBy(
    jobId: JobId,
    workflow: ComfyWorkflow,
    workflowId?: string
  ): boolean {
    return (
      ownershipByInstance(jobId, workflow) ??
      ownershipByPath(jobId, workflow) ??
      ownershipByWorkflowId(jobId, workflow, workflowId) ??
      false
    )
  }

  function focusedJobFor(workflow: ComfyWorkflow): JobId | undefined {
    const activeId = activeJobId.value
    if (activeId && isJobOwnedBy(activeId, workflow)) return activeId
    return startedJobIdsByStart(queuedJobs.value).findLast((jobId) =>
      isJobOwnedBy(jobId, workflow)
    )
  }

  function rememberStampAndCheckOutputOwner(
    jobId: JobId | undefined,
    workflowId?: string
  ): boolean {
    return (
      rememberStampAndCheckActiveWorkflow(jobId, workflowId) &&
      jobId === activeJobId.value
    )
  }

  function setActiveJob(jobId: JobId | null) {
    const changed = activeJobId.value !== jobId
    if (changed) executionIdToLocatorCache.clear()
    activeJobId.value = jobId
    showActiveJobProgress()
    if (changed) showJobOutputs(jobId)
  }

  function showActiveJobProgress() {
    const jobId = activeJobId.value
    const shown =
      jobId && rememberStampAndCheckActiveWorkflow(jobId)
        ? (nodeProgressStatesByJob.value[jobId] ?? {})
        : {}
    nodeProgressStates.value = shown
  }

  function activateIfIdle(jobId: JobId) {
    queuedJobs.value[jobId] ??= { nodes: {} }
    queuedJobs.value[jobId].executionStartedAt ??= performance.now()
    if (!activeJobId.value) setActiveJob(jobId)
  }

  function activateOverForeignJob(jobId: JobId) {
    const activeId = activeJobId.value
    if (!activeId || activeId === jobId) return
    if (rememberStampAndCheckActiveWorkflow(activeId)) return
    if (rememberStampAndCheckActiveWorkflow(jobId)) setActiveJob(jobId)
  }

  function handOffActiveJob() {
    const started = startedJobIdsByStart(queuedJobs.value)
    setActiveJob(
      started.findLast((jobId) => rememberStampAndCheckActiveWorkflow(jobId)) ??
        started.at(-1) ??
        null
    )
  }

  function handleExecutionStart(e: CustomEvent<ExecutionStartWsMessage>) {
    const jobId = e.detail.prompt_id
    queuedJobs.value[jobId] ??= { nodes: {} }
    clearInitializationByJobId(jobId)

    if (!jobIdToSessionWorkflowPath.value.has(jobId)) {
      const workflow = queuedJobs.value[jobId]?.workflow
      if (workflow) {
        ensureSessionWorkflowPath(jobId, workflow.path, workflow.instanceId)
      }
    }
    queuedJobs.value[jobId].executionStartedAt ??= performance.now()
    const startTimestamp = e.detail.timestamp
    queuedJobs.value[jobId].executionStartedAtWallMs ??= Number.isFinite(
      startTimestamp
    )
      ? startTimestamp
      : Date.now()
    setWorkflowStatus(jobId, {
      status: 'running',
      executionStartedAt: queuedJobs.value[jobId].executionStartedAt
    })

    rememberStampedWorkflowId(jobId, e.detail.workflow_id)
    executionErrorStore.clearExecutionStartErrors(runErrorKeyForJob(jobId))
    activateIfIdle(jobId)
    activateOverForeignJob(jobId)
    if (!queuedJobs.value[jobId].nodeLookup) void adoptRunningPrompt(jobId)
  }

  async function adoptRunningPrompt(jobId: JobId) {
    let prompt: ComfyApiWorkflow | undefined
    try {
      const res = await api.fetchApi('/queue')
      if (!res.ok) {
        reportQueueReadFailure(new Error(`GET /queue ${res.status}`), jobId)
        return
      }
      prompt = findRunningPrompt(await res.json(), jobId)
    } catch (cause) {
      reportQueueReadFailure(cause, jobId)
      return
    }
    if (!prompt || !Object.hasOwn(queuedJobs.value, jobId)) return
    const job = queuedJobs.value[jobId]
    if (job.nodeLookup) return
    job.nodes = {
      ...Object.fromEntries(Object.keys(prompt).map((id) => [id, false])),
      ...job.nodes
    }
    job.nodeLookup = buildExecutionNodeLookup(prompt)
  }

  function reportQueueReadFailure(cause: unknown, jobId: JobId): void {
    reportError(cause, {
      surface: 'graph',
      errorType: 'warning_queue_read_failed_for_adopted_run',
      level: 'warning',
      context: { jobId }
    })
  }

  function handleExecutionCached(e: CustomEvent<ExecutionCachedWsMessage>) {
    const jobId = e.detail.prompt_id
    if (!(jobId in queuedJobs.value)) return
    for (const n of e.detail.nodes) {
      queuedJobs.value[jobId].nodes[n] = true
    }
  }

  function handleExecutionInterrupted(
    e: CustomEvent<ExecutionInterruptedWsMessage>
  ) {
    const jobId = e.detail.prompt_id
    pendingExecutionErrorsByJobId.delete(jobId)
    setWorkflowStatus(jobId, {
      status: 'failed',
      endTime: performance.now(),
      failureReason: 'execution_interrupted',
      showStatus: false
    })
    const workflow = jobIdToWorkflow.get(jobId)
    if (workflow) clearWorkflowStatus(workflow)
    clearInitializationByJobId(jobId)
    resetExecutionState(jobId)
  }

  function handleExecuted(e: CustomEvent<ExecutedWsMessage>) {
    const jobId = e.detail.prompt_id
    if (!(jobId in queuedJobs.value)) return
    const queuedJob = queuedJobs.value[jobId]
    queuedJob.nodes[e.detail.node] = true
    recordJobOutput(queuedJob, e.detail)
  }

  function recordJobOutput(queuedJob: QueuedJob, detail: ExecutedWsMessage) {
    const outputs = (queuedJob.outputs ??= {})
    const executionId = detail.display_node || detail.node
    const existing = outputs[executionId]
    outputs[executionId] =
      detail.merge && existing
        ? mergeNodeOutput(existing, detail.output)
        : detail.output
  }

  function showJobOutputs(jobId: JobId | null | undefined) {
    const outputs = jobId ? queuedJobs.value[jobId]?.outputs : undefined
    if (!outputs || !rememberStampAndCheckActiveWorkflow(jobId ?? undefined))
      return
    const nodeOutputStore = useNodeOutputStore()
    for (const [id, output] of Object.entries(outputs)) {
      const executionId = tryNormalizeNodeExecutionId(id)
      if (executionId)
        nodeOutputStore.setNodeOutputsByExecutionId(executionId, output)
    }
    useExtensionServiceAccess().invokeExtensions(
      'onNodeOutputsUpdated',
      useApp().nodeOutputs
    )
  }

  function handleExecutionSuccess(e: CustomEvent<ExecutionSuccessWsMessage>) {
    const jobId = e.detail.prompt_id
    pendingExecutionErrorsByJobId.delete(jobId)
    setWorkflowStatus(jobId, {
      status: 'completed',
      endTime: performance.now()
    })
    const queuedJob = queuedJobs.value[jobId]
    const telemetry = useTelemetry()
    if (jobId in queuedJobs.value) {
      telemetry?.trackExecutionSuccess({
        jobId
      })
      if (queuedJob.shareId) {
        telemetry?.trackSharedWorkflowRun({
          job_id: jobId,
          share_id: queuedJob.shareId,
          view_mode: queuedJob.viewMode ?? mode.value,
          is_app_mode: queuedJob.isAppMode ?? isAppMode.value
        })
      }
    }
    resetExecutionState(jobId)
  }

  /**
   * Evicts the oldest entries from {@link nodeProgressStatesByJob} when the
   * map exceeds {@link MAX_PROGRESS_JOBS}, preventing unbounded memory
   * growth in long-running sessions.
   *
   * Relies on ES2015+ object key insertion order: the first keys returned
   * by `Object.keys` are the oldest entries.
   *
   * @example
   * ```ts
   * // Given 105 entries, evicts the 5 oldest:
   * evictOldProgressJobs()
   * Object.keys(nodeProgressStatesByJob.value).length // => 100
   * ```
   */
  function evictOldProgressJobs() {
    const current = nodeProgressStatesByJob.value
    const keys = Object.keys(current)
    if (keys.length <= MAX_PROGRESS_JOBS) return

    const pruned: Record<string, Record<string, NodeProgressState>> = {}
    const keysToKeep = keys.slice(keys.length - MAX_PROGRESS_JOBS)
    for (const key of keysToKeep) {
      pruned[key] = current[key]
    }
    nodeProgressStatesByJob.value = pruned
  }

  const pendingProgressStatesByJob = new Map<JobId, ProgressStateWsMessage>()
  const progressStateCoalescer = createRafCoalescer<null>(() => {
    const updates = [...pendingProgressStatesByJob.values()]
    pendingProgressStatesByJob.clear()
    for (const detail of updates) applyProgressState(detail)
  }, 'raf:progress_state')

  function handleProgressState(e: CustomEvent<ProgressStateWsMessage>) {
    const jobId = e.detail.prompt_id
    if (findRunningNode(e.detail.nodes)) {
      rememberStampedWorkflowId(jobId, e.detail.workflow_id)
      activateIfIdle(jobId)
      activateOverForeignJob(jobId)
    }
    pendingProgressStatesByJob.delete(jobId)
    pendingProgressStatesByJob.set(jobId, e.detail)
    progressStateCoalescer.push(null)
  }

  function revokeStartedNodePreviews(
    nodes: Record<string, NodeProgressState>,
    previousForJob: Record<string, NodeProgressState>
  ) {
    const { revokePreviewsByExecutionId } = useNodeOutputStore()
    for (const nodeId in nodes) {
      if (nodes[nodeId].state !== 'running' || nodeId in previousForJob)
        continue
      const executionId = tryNormalizeNodeExecutionId(nodeId)
      if (executionId) revokePreviewsByExecutionId(executionId)
    }
  }

  function applyProgressState(detail: ProgressStateWsMessage) {
    const { nodes, prompt_id: jobId, workflow_id: workflowId } = detail
    const isShown = rememberStampAndCheckOutputOwner(jobId, workflowId)

    if (isShown) {
      revokeStartedNodePreviews(
        nodes,
        nodeProgressStatesByJob.value[jobId] ?? {}
      )
    }

    nodeProgressStatesByJob.value = {
      ...nodeProgressStatesByJob.value,
      [jobId]: nodes
    }
    evictOldProgressJobs()

    if (isShown) nodeProgressStates.value = nodes
    const running = findRunningNode(nodes)?.[1]
    if (!running) return
    progressByJob.value = {
      ...progressByJob.value,
      [jobId]: {
        value: running.value,
        max: running.max,
        prompt_id: running.prompt_id,
        node: running.display_node_id || running.node_id
      }
    }
  }

  const pendingProgressByJob = new Map<JobId, ProgressWsMessage>()
  const progressCoalescer = createRafCoalescer<null>(() => {
    const updates = [...pendingProgressByJob.values()]
    pendingProgressByJob.clear()
    for (const detail of updates)
      progressByJob.value = {
        ...progressByJob.value,
        [detail.prompt_id]: detail
      }
  }, 'raf:progress')

  function handleProgress(e: CustomEvent<ProgressWsMessage>) {
    const jobId = e.detail.prompt_id
    activateIfIdle(jobId)
    pendingProgressByJob.delete(jobId)
    pendingProgressByJob.set(jobId, e.detail)
    progressCoalescer.push(null)
  }

  function cancelPendingProgressUpdates(jobId?: JobId | null) {
    if (!jobId) {
      pendingProgressByJob.clear()
      pendingProgressStatesByJob.clear()
      progressCoalescer.cancel()
      progressStateCoalescer.cancel()
      return
    }

    pendingProgressByJob.delete(jobId)
    pendingProgressStatesByJob.delete(jobId)
    if (pendingProgressByJob.size === 0) progressCoalescer.cancel()
    if (pendingProgressStatesByJob.size === 0) progressStateCoalescer.cancel()
  }

  function handleStatus() {
    if (api.clientId) {
      clientId.value = api.clientId

      // Once we've received the clientId we no longer need to listen
      api.removeEventListener('status', handleStatus)
    }
  }

  /**
   * Queue and history polling supply a workflow id but no path, so the open
   * workflow carrying that root graph provides it. Two open workflows can share
   * a root graph id — an imported copy of one already on screen — and those runs
   * belong to different error buckets, so an ambiguous match resolves to
   * nothing rather than the wrong workflow.
   */
  function openWorkflowPathForGraph(graphId: WorkflowId): string | undefined {
    const matches = workflowStore.openWorkflows.filter(
      (w) => (w.activeState?.id ?? w.initialState?.id) === graphId
    )
    return matches.length === 1 ? matches[0].path : undefined
  }

  /**
   * Run-error key of the workflow that produced `jobId`, for filing its errors
   * against that workflow rather than whichever one is currently on screen.
   *
   * `jobIdToWorkflow` only covers jobs queued by this browser session and is
   * purged the moment a run ends, so `jobIdToWorkflowId` — also populated from
   * queue and history polling — backs it up for jobs from a previous page load.
   *
   * `null` means the job cannot be attributed to one known workflow, so
   * recording is suppressed rather than assigning it to whichever workflow is
   * currently visible.
   */
  function runErrorKeyForJob(jobId: string): string | null {
    const workflow = jobIdToWorkflow.get(jobId)
    const graphId =
      workflow?.activeState?.id ??
      workflow?.initialState?.id ??
      jobIdToWorkflowId.value.get(jobId)
    if (graphId === undefined) return null

    const path =
      workflow?.path ??
      jobIdToSessionWorkflowPath.value.get(jobId) ??
      openWorkflowPathForGraph(graphId)
    if (path === undefined) return null

    return executionErrorStore.runErrorKey(graphId, path)
  }

  function handleExecutionError(e: CustomEvent<ExecutionErrorWsMessage>) {
    const endTime = performance.now()
    // Resolved up front: resetExecutionState() drops the job's workflow entry
    // before the handlers below record anything.
    const runErrorKey = runErrorKeyForJob(e.detail.prompt_id)
    if (runErrorKey === null) {
      bufferPendingExecutionError({ detail: e.detail, endTime })
      resetExecutionState(e.detail.prompt_id)
      return
    }

    processExecutionError(e.detail, runErrorKey, endTime)
  }

  function handlePromptOutputsSkipped(
    e: CustomEvent<PromptOutputsSkippedData>
  ) {
    const nodeErrors = normalizeRelayedNodeErrors(e.detail.node_errors)
    if (Object.keys(nodeErrors).length === 0) return
    recordSkippedOutputs(e.detail.prompt_id, nodeErrors)
  }

  function recordSkippedOutputs(
    jobId: string,
    nodeErrors: Record<string, NodeError>
  ) {
    const runErrorKey = runErrorKeyForJob(jobId)
    if (runErrorKey === null) {
      bufferByJobId(pendingSkippedOutputsByJobId, jobId, nodeErrors)
      return
    }
    executionErrorStore.surfaceNodeErrors(nodeErrors, runErrorKey, jobId)
  }

  function flushPendingSkippedOutputs(jobId: string) {
    const pending = pendingSkippedOutputsByJobId.get(jobId)
    if (!pending) return
    pendingSkippedOutputsByJobId.delete(jobId)
    recordSkippedOutputs(jobId, pending)
  }

  function processExecutionError(
    detail: ExecutionErrorWsMessage,
    runErrorKey: string,
    endTime: number
  ) {
    setWorkflowStatus(detail.prompt_id, {
      status: 'failed',
      endTime,
      failureReason: 'execution_failed',
      showStatus: false
    })
    useTelemetry()?.trackExecutionError({
      jobId: detail.prompt_id,
      nodeId: String(detail.node_id),
      nodeType: detail.node_type,
      error: detail.exception_message
    })

    if (isCloud) {
      // Cloud wraps validation errors (400) in exception_message as embedded JSON.
      // Pre-flight validation isn't a runtime failure — no badge.
      if (handleCloudValidationError(detail, runErrorKey)) {
        executionErrorStore.showExecutionError(detail, runErrorKey)
        return
      }
    }

    // Account preconditions (sign-in, subscription, credits) open their own
    // modal and must stay out of the error panel and error count.
    if (handleAccountPreconditionError(detail)) return

    // Service-level errors (e.g. "Job has stagnated") have no associated node.
    if (handleServiceLevelError(detail, runErrorKey)) {
      executionErrorStore.showExecutionError(detail, runErrorKey)
      return
    }

    setWorkflowStatus(detail.prompt_id, {
      status: 'failed',
      endTime,
      failureReason: 'execution_failed'
    })
    executionErrorStore.recordExecutionError(detail, runErrorKey)
    executionErrorStore.showExecutionError(detail, runErrorKey)
    clearInitializationByJobId(detail.prompt_id)
    resetExecutionState(detail.prompt_id)
  }

  function handleAccountPreconditionError(
    detail: ExecutionErrorWsMessage
  ): boolean {
    const precondition = resolveAccountPrecondition({
      exceptionType: detail.exception_type,
      exceptionMessage: detail.exception_message
    })
    if (!precondition) return false

    const workflow = jobIdToWorkflow.get(detail.prompt_id)
    if (workflow) clearWorkflowStatus(workflow)
    clearInitializationByJobId(detail.prompt_id)
    resetExecutionState(detail.prompt_id)
    return true
  }

  function handleServiceLevelError(
    detail: RuntimeExecutionError,
    runErrorKey: string | null | undefined
  ): boolean {
    const { node_id: nodeId } = detail
    if (nodeId !== null && nodeId !== undefined && String(nodeId) !== '')
      return false

    clearInitializationByJobId(detail.prompt_id)
    resetExecutionState(detail.prompt_id)
    executionErrorStore.recordPromptError(
      {
        type: detail.exception_type || 'error',
        message: detail.exception_type
          ? `${detail.exception_type}: ${detail.exception_message}`
          : detail.exception_message || '',
        details: detail.traceback?.join('\n') ?? ''
      },
      runErrorKey
    )
    return true
  }

  function handleCloudValidationError(
    detail: ExecutionErrorWsMessage,
    runErrorKey: string | null | undefined
  ): boolean {
    const result = classifyCloudValidationError(detail)
    if (!result) return false

    clearInitializationByJobId(detail.prompt_id)
    resetExecutionState(detail.prompt_id)

    if (result.kind === 'nodeErrors') {
      executionErrorStore.recordNodeErrors(
        result.nodeErrors,
        runErrorKey,
        detail.prompt_id
      )
    } else {
      executionErrorStore.recordPromptError(result.promptError, runErrorKey)
    }
    return true
  }

  /**
   * Notification handler used for frontend/cloud initialization tracking.
   * Marks a job as initializing when cloud notifies it is waiting for a machine.
   */
  function handleNotification(e: CustomEvent<NotificationWsMessage>) {
    const payload = e.detail
    const text = payload.value || ''
    const id = payload.id ? payload.id : ''
    if (!id) return
    // Until cloud implements a proper message
    if (text.includes('Waiting for a machine')) {
      const next = new Set(initializingJobIds.value)
      next.add(id)
      initializingJobIds.value = next
    }
  }

  function clearInitializationByJobId(jobId: JobId | null) {
    if (!jobId) return
    if (!initializingJobIds.value.has(jobId)) return
    const next = new Set(initializingJobIds.value)
    next.delete(jobId)
    initializingJobIds.value = next
  }

  function clearInitializationByJobIds(jobIds: JobId[]) {
    if (!jobIds.length) return
    const current = initializingJobIds.value
    const toRemove = jobIds.filter((id) => current.has(id))
    if (!toRemove.length) return
    const next = new Set(current)
    for (const id of toRemove) {
      next.delete(id)
    }
    initializingJobIds.value = next
  }

  function reconcileInitializingJobs(activeJobIds: Set<JobId>) {
    const orphaned = [...initializingJobIds.value].filter(
      (id) => !activeJobIds.has(id)
    )
    clearInitializationByJobIds(orphaned)
  }

  /**
   * Clears the active job if the server's queue snapshot doesn't list it.
   * Used after WS reconnect to recover from stale state when a job finished
   * during the disconnect window.
   */
  function clearActiveJobIfStale(activeJobIds: Set<JobId>) {
    const id = activeJobId.value
    if (id && !activeJobIds.has(id)) resetExecutionState(id)
  }

  function forgetFinishedJobs(jobIds: Iterable<JobId>) {
    for (const jobId of jobIds) {
      if (!(jobId in queuedJobs.value)) continue
      const workflow = jobIdToWorkflow.get(jobId)
      forgetJob(jobId)
      if (jobId === activeJobId.value) handOffActiveJob()
      if (
        workflow &&
        getWorkflowStatus(workflow) === 'running' &&
        !hasStartedJobForWorkflow(workflow)
      ) {
        clearWorkflowStatus(workflow)
      }
    }
  }

  function hasStartedJobForWorkflow(workflow: ComfyWorkflow): boolean {
    return Object.entries(queuedJobs.value).some(
      ([jobId, job]) =>
        job.executionStartedAt !== undefined &&
        jobIdToWorkflow.get(jobId) === workflow
    )
  }

  function forgetJob(jobId: JobId) {
    const progress = { ...nodeProgressStatesByJob.value }
    delete progress[jobId]
    nodeProgressStatesByJob.value = progress
    if (jobId in progressByJob.value) {
      const { [jobId]: _, ...rest } = progressByJob.value
      progressByJob.value = rest
    }
    useJobPreviewStore().clearPreview(jobId)
    jobIdToWorkflow.delete(jobId)
    jobIdToStampedWorkflowId.delete(jobId)
    if (jobId in queuedJobs.value)
      void jobReset.trigger(queuedJobs.value[jobId])
    delete queuedJobs.value[jobId]
    cancelPendingProgressUpdates(jobId)
  }

  function isJobInitializing(jobId: JobId | number | undefined): boolean {
    if (!jobId) return false
    return initializingJobIds.value.has(String(jobId))
  }

  /**
   * Reset execution-related state after a run completes or is stopped.
   */
  function resetExecutionState(jobIdParam?: JobId | null) {
    const jobId = jobIdParam ?? activeJobId.value ?? null
    const runErrorKey = jobId ? runErrorKeyForJob(jobId) : undefined
    if (jobId) forgetJob(jobId)
    else cancelPendingProgressUpdates()
    if (!activeJobId.value || jobId === activeJobId.value) handOffActiveJob()
    executionErrorStore.clearPromptError(runErrorKey)
  }

  function storeJob({
    nodes,
    id,
    promptOutput,
    startTime,
    submissionAcceptedAt,
    workflow,
    mode,
    workflowContext,
    workflowExecutionIntent = defaultWorkflowExecutionIntent
  }: {
    nodes: string[]
    id: JobId
    promptOutput: ComfyApiWorkflow
    startTime?: number
    submissionAcceptedAt?: number
    workflow: ComfyWorkflow
    mode: AppMode
    workflowContext?: WorkflowExecutionContext
    workflowExecutionIntent?: WorkflowExecutionIntent
  }) {
    queuedJobs.value[id] ??= { nodes: {} }
    const queuedJob = queuedJobs.value[id]
    queuedJob.nodes = {
      ...nodes.reduce((p: Record<string, boolean>, n) => {
        p[n] = false
        return p
      }, {}),
      ...queuedJob.nodes
    }
    queuedJob.nodeLookup = buildExecutionNodeLookup(promptOutput)
    queuedJob.startTime = startTime
    queuedJob.submissionAcceptedAt = submissionAcceptedAt
    queuedJob.workflowContext = workflowContext
    queuedJob.workflowExecutionIntent = workflowExecutionIntent
    queuedJob.shareId = workflow.shareId
    queuedJob.viewMode = mode
    queuedJob.isAppMode = isAppModeValue(mode)
    registerJobOwner(id, workflow)
  }

  /** Routes a job's frames and outputs to `workflow`, including jobs queued elsewhere. */
  function registerJobOwner(id: JobId, workflow: ComfyWorkflow) {
    queuedJobs.value[id] ??= { nodes: {} }
    const queuedJob = queuedJobs.value[id]
    queuedJob.workflow = workflow
    jobIdToWorkflow.set(id, workflow)
    const wid = workflow.activeState?.id ?? workflow.initialState?.id
    if (wid) {
      jobIdToWorkflowId.value.set(id, wid)
    }
    if (workflow.path) {
      ensureSessionWorkflowPath(id, workflow.path, workflow.instanceId)
    }
    flushPendingWorkflowStatus(id, workflow)
    flushPendingExecutionError(id)
    flushPendingSkippedOutputs(id)
    if (id === activeJobId.value) showActiveJobProgress()
    else if (
      id in queuedJobs.value &&
      queuedJob.executionStartedAt !== undefined
    )
      activateOverForeignJob(id)
  }

  function flushPendingExecutionError(jobId: string) {
    const pending = pendingExecutionErrorsByJobId.get(jobId)
    if (!pending) return

    const runErrorKey = runErrorKeyForJob(jobId)
    if (runErrorKey === null) return

    pendingExecutionErrorsByJobId.delete(jobId)
    processExecutionError(pending.detail, runErrorKey, pending.endTime)
  }

  function flushPendingWorkflowStatus(
    jobId: string,
    workflow: ComfyWorkflow | undefined
  ) {
    const pending = pendingWorkflowStatusByJobId.get(jobId)
    if (pending === undefined || !workflow) return
    pendingWorkflowStatusByJobId.delete(jobId)
    queuedJobs.value[jobId].executionStartedAt = pending.executionStartedAt
    // Don't let a stale 'running' overwrite a terminal status already set.
    if (pending.status === 'running' && workflowStatus.value.has(workflow))
      return
    if (pending.showStatus !== false) {
      applyWorkflowStatus(workflow, pending.status)
    }
    trackExecutionOutcome(jobId, pending)
    if (pending.status === 'running' || activeJobId.value === jobId) return
    delete queuedJobs.value[jobId]
    jobIdToWorkflow.delete(jobId)
  }

  // ~0.65 MB at capacity (32 char GUID key + 50 char path value)
  const MAX_SESSION_PATH_ENTRIES = 4000

  function ensureSessionWorkflowPath(
    jobId: JobId,
    path: string,
    workflowInstanceId?: string
  ) {
    if (workflowInstanceId) {
      jobIdToWorkflowInstanceId.set(jobId, workflowInstanceId)
    }
    if (jobIdToSessionWorkflowPath.value.get(jobId) === path) return
    const next = new Map(jobIdToSessionWorkflowPath.value)
    next.set(jobId, path)
    while (next.size > MAX_SESSION_PATH_ENTRIES) {
      const oldest = next.keys().next().value
      if (oldest !== undefined) {
        next.delete(oldest)
        jobIdToWorkflowInstanceId.delete(oldest)
      } else break
    }
    jobIdToSessionWorkflowPath.value = next
  }

  function rewriteSessionWorkflowPaths(
    workflowInstanceId: string,
    newPath: string
  ) {
    let next: Map<string, string> | undefined
    for (const [jobId, path] of jobIdToSessionWorkflowPath.value) {
      if (path === newPath) continue
      if (jobIdToWorkflowInstanceId.get(jobId) !== workflowInstanceId) continue
      next ??= new Map(jobIdToSessionWorkflowPath.value)
      next.set(jobId, newPath)
    }
    if (next) jobIdToSessionWorkflowPath.value = next
  }

  workflowStore.onWorkflowRenamed((workflow) =>
    rewriteSessionWorkflowPaths(workflow.instanceId, workflow.path)
  )

  /**
   * Register or update a mapping from job ID to workflow ID.
   */
  function registerJobWorkflowIdMapping(jobId: JobId, workflowId: WorkflowId) {
    if (!jobId || !workflowId) return
    jobIdToWorkflowId.value.set(jobId, workflowId)
    rememberStampedWorkflowId(jobId, workflowId)
    flushPendingExecutionError(jobId)
    flushPendingSkippedOutputs(jobId)
  }

  /**
   * Convert a NodeLocatorId to an execution context ID
   * @param locatorId The NodeLocatorId
   * @returns The execution ID or null if conversion fails
   */
  const nodeLocatorIdToExecutionId = (
    locatorId: NodeLocatorId
  ): string | null => {
    const executionId = workflowStore.nodeLocatorIdToNodeExecutionId(locatorId)
    return executionId
  }

  const runningJobIds = computed<JobId[]>(() => {
    const result: JobId[] = []
    for (const [pid, nodes] of Object.entries(nodeProgressStatesByJob.value)) {
      if (findRunningNode(nodes)) result.push(pid)
    }
    return result
  })

  const runningWorkflowCount = computed<number>(
    () => runningJobIds.value.length
  )

  function adoptActiveWorkflowJob() {
    executionIdToLocatorCache.clear()
    const workflow = workflowStore.activeWorkflow
    setActiveJob((workflow && focusedJobFor(workflow)) ?? activeJobId.value)
  }

  function openWorkflowForJob(jobId: JobId): ComfyWorkflow | undefined {
    const workflow = jobIdToWorkflow.get(jobId)
    if (workflow && workflowStore.isOpen(workflow)) return workflow
    const instanceId = jobIdToWorkflowInstanceId.get(jobId)
    const byInstance =
      instanceId &&
      workflowStore.openWorkflows.find((w) => w.instanceId === instanceId)
    if (byInstance) return byInstance
    const path = jobIdToSessionWorkflowPath.value.get(jobId)
    const byPath = path && workflowStore.getWorkflowByPath(path)
    if (byPath && workflowStore.isOpen(byPath)) return byPath
    if (!predatesLoad(jobId)) return
    const graphId =
      jobIdToStampedWorkflowId.get(jobId) ?? jobIdToWorkflowId.value.get(jobId)
    if (!graphId) return
    return workflowStore.openWorkflows.find(
      (w) => (w.activeState?.id ?? w.initialState?.id) === graphId
    )
  }

  function focusJob(jobId: JobId): boolean {
    if (queuedJobs.value[jobId]?.executionStartedAt === undefined) return false
    if (!rememberStampAndCheckActiveWorkflow(jobId)) return false
    setActiveJob(jobId)
    return true
  }

  watch(() => workflowStore.activeWorkflow, adoptActiveWorkflowJob)

  const isActiveWorkflowRunning = computed(() => {
    if (!activeJobId.value) return false
    const path = workflowStore.activeWorkflow?.path
    if (!path) return false
    return jobIdToSessionWorkflowPath.value.get(activeJobId.value) === path
  })

  function getExecutionStartWallMs(jobId: JobId): number | undefined {
    return queuedJobs.value[jobId]?.executionStartedAtWallMs
  }

  return {
    isIdle,
    clientId,
    activeJobId,
    queuedJobs,
    getExecutionStartWallMs,
    executingNodeId,
    executingNodeIds,
    activeJob,
    executionProgress,
    executingNode,
    executingNodeProgress,
    nodeProgressStates,
    nodeLocationProgressStates,
    nodeProgressStatesByJob,
    runningJobIds,
    runningWorkflowCount,
    initializingJobIds,
    rememberStampAndCheckActiveWorkflow,
    rememberStampAndCheckOutputOwner,
    focusedJobFor,
    showJobOutputs,
    focusJob,
    openWorkflowForJob,
    executionProgressForJob,
    executingNodeForJob,
    executingNodeProgressForJob,
    isActiveWorkflowRunning,
    isJobInitializing,
    clearInitializationByJobId,
    clearInitializationByJobIds,
    reconcileInitializingJobs,
    recordJobIdsAtLoad,
    clearActiveJobIfStale,
    forgetFinishedJobs,
    bindExecutionEvents,
    unbindExecutionEvents,
    onJobReset: jobReset.on,
    storeJob,
    registerJobOwner,
    registerJobWorkflowIdMapping,
    uniqueExecutingNodeIdStrings,
    // Raw executing progress data for backward compatibility in ComfyApp.
    _executingNodeProgress,
    // NodeLocatorId conversion helpers
    nodeLocatorIdToExecutionId,
    jobIdToWorkflowId,
    jobIdToSessionWorkflowPath,
    ensureSessionWorkflowPath,
    getWorkflowStatus,
    clearWorkflowStatus
  }
})
