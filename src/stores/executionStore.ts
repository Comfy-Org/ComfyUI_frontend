import { defineStore } from 'pinia'
import { computed, ref, shallowRef, watch } from 'vue'

import { useNodeProgressText } from '@/composables/node/useNodeProgressText'
import { useAppMode } from '@/composables/useAppMode'
import { isCloud } from '@/platform/distribution/types'
import { resolveAccountPrecondition } from '@/platform/errorCatalog/accountPreconditionRouting'
import { useTelemetry } from '@/platform/telemetry'
import type {
  WorkflowExecutionContext,
  WorkflowExecutionFailureReason,
  WorkflowExecutionIntent
} from '@/platform/telemetry/types'
import type {
  ComfyWorkflow,
  LoadedComfyWorkflow
} from '@/platform/workflow/management/stores/workflowStore'
import { useWorkflowStore } from '@/platform/workflow/management/stores/workflowStore'
import type {
  ComfyApiWorkflow,
  WorkflowId
} from '@/platform/workflow/validation/schemas/workflowSchema'
import { useCanvasStore } from '@/renderer/core/canvas/canvasStore'
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
  ProgressTextWsMessage,
  ProgressWsMessage
} from '@/platform/remote/comfyui/execution/types'
import { api } from '@/scripts/api'
import { app } from '@/scripts/app'
import { useNodeOutputStore } from '@/stores/nodeOutputStore'
import { useJobPreviewStore } from '@/stores/jobPreviewStore'
import { useExecutionErrorStore } from '@/stores/executionErrorStore'
import { tryNormalizeNodeExecutionId } from '@/types/nodeIdentification'
import type { SerializedNodeId } from '@/types/nodeId'
import { parseNodeId } from '@/types/nodeId'
import type { NodeLocatorId } from '@/types/nodeIdentification'
import type { AppMode } from '@/utils/appMode'
import { isAppModeValue } from '@/utils/appMode'
import { classifyCloudValidationError } from '@/utils/executionErrorUtil'
import { executionIdToNodeLocatorId } from '@/utils/graphTraversalUtil'
import { createRafCoalescer } from '@/utils/rafBatch'

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

interface QueuedJob {
  /**
   * The nodes that are queued to be executed. The key is the node id and the
   * value is a boolean indicating if the node has been executed.
   */
  nodes: Record<string, boolean>
  startTime?: number
  submissionAcceptedAt?: number
  executionStartedAt?: number
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
  const canvasStore = useCanvasStore()
  const executionErrorStore = useExecutionErrorStore()
  const { mode, isAppMode } = useAppMode()

  const clientId = ref<string | null>(null)
  const activeJobId = ref<JobId | null>(null)
  const queuedJobs = ref<Record<JobId, QueuedJob>>({})
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

  const initializingJobIds = ref<Set<JobId>>(new Set())

  const workflowStatus = shallowRef<
    Map<ComfyWorkflow, WorkflowExecutionStatus>
  >(new Map())

  const jobIdToWorkflow = new Map<string, ComfyWorkflow>()

  // Buffers statuses arriving before storeJob attaches the workflow.
  // FIFO-capped to bound growth if a matching storeJob never fires.
  const pendingWorkflowStatusByJobId = new Map<string, WorkflowStatusUpdate>()
  const pendingExecutionErrorsByJobId = new Map<string, PendingExecutionError>()

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

  function bufferPendingExecutionError(error: PendingExecutionError) {
    const jobId = error.detail.prompt_id
    pendingExecutionErrorsByJobId.delete(jobId)
    pendingExecutionErrorsByJobId.set(jobId, error)
    while (pendingExecutionErrorsByJobId.size > MAX_PROGRESS_JOBS) {
      const oldest = pendingExecutionErrorsByJobId.keys().next().value
      if (oldest === undefined) break
      pendingExecutionErrorsByJobId.delete(oldest)
    }
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
    const locatorId = executionIdToNodeLocatorId(app.rootGraph, executionId)
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
      if (!messageMatchesActiveWorkflow(state.prompt_id, state.workflow_id))
        continue
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
  const _executingNodeProgress = ref<ProgressWsMessage | null>(null)
  const executingNodeProgress = computed(() =>
    _executingNodeProgress.value
      ? _executingNodeProgress.value.value / _executingNodeProgress.value.max
      : null
  )

  const activeJob = computed<QueuedJob | undefined>(
    () => queuedJobs.value[activeJobId.value ?? '']
  )

  const totalNodesToExecute = computed<number>(() => {
    if (!activeJob.value) return 0
    return Object.values(activeJob.value.nodes).length
  })

  const isIdle = computed<boolean>(() => !activeJobId.value)

  const nodesExecuted = computed<number>(() => {
    if (!activeJob.value) return 0
    return Object.values(activeJob.value.nodes).filter(Boolean).length
  })

  const executionProgress = computed<number>(() => {
    if (!activeJob.value) return 0
    const total = totalNodesToExecute.value
    const done = nodesExecuted.value
    return total > 0 ? done / total : 0
  })

  function bindExecutionEvents() {
    api.addEventListener('notification', handleNotification)
    api.addEventListener('execution_start', handleExecutionStart)
    api.addEventListener('execution_cached', handleExecutionCached)
    api.addEventListener('execution_interrupted', handleExecutionInterrupted)
    api.addEventListener('execution_success', handleExecutionSuccess)
    api.addEventListener('executed', handleExecuted)
    api.addEventListener('executing', handleExecuting)
    api.addEventListener('progress', handleProgress)
    api.addEventListener('progress_state', handleProgressState)
    api.addEventListener('status', handleStatus)
    api.addEventListener('execution_error', handleExecutionError)
    api.addEventListener('progress_text', handleProgressText)
  }

  function unbindExecutionEvents() {
    api.removeEventListener('notification', handleNotification)
    api.removeEventListener('execution_start', handleExecutionStart)
    api.removeEventListener('execution_cached', handleExecutionCached)
    api.removeEventListener('execution_interrupted', handleExecutionInterrupted)
    api.removeEventListener('execution_success', handleExecutionSuccess)
    api.removeEventListener('executed', handleExecuted)
    api.removeEventListener('executing', handleExecuting)
    api.removeEventListener('progress', handleProgress)
    api.removeEventListener('progress_state', handleProgressState)
    api.removeEventListener('status', handleStatus)
    api.removeEventListener('execution_error', handleExecutionError)
    api.removeEventListener('progress_text', handleProgressText)

    if (workflowStatus.value.size > 0) workflowStatus.value = new Map()
    pendingWorkflowStatusByJobId.clear()
    pendingExecutionErrorsByJobId.clear()
    jobIdToWorkflow.clear()

    cancelPendingProgressUpdates()
  }

  function handleExecutionStart(e: CustomEvent<ExecutionStartWsMessage>) {
    const jobId = e.detail.prompt_id
    queuedJobs.value[jobId] ??= { nodes: {} }
    clearInitializationByJobId(jobId)

    // Ensure path mapping exists — execution_start can arrive via WebSocket
    // before the HTTP response from queuePrompt triggers storeJob.
    if (!jobIdToSessionWorkflowPath.value.has(jobId)) {
      const workflow = queuedJobs.value[jobId]?.workflow
      if (workflow) {
        ensureSessionWorkflowPath(jobId, workflow.path, workflow.instanceId)
      }
    }
    queuedJobs.value[jobId].executionStartedAt ??= performance.now()
    setWorkflowStatus(jobId, {
      status: 'running',
      executionStartedAt: queuedJobs.value[jobId].executionStartedAt
    })

    // Only adopt as the global active job and clear shared UI state when the
    // starting job belongs to the active workflow. Otherwise a job started
    // from another tab would steal activeJobId and clobber the active tab's
    // execution UI.
    if (!messageMatchesActiveWorkflow(jobId, e.detail.workflow_id)) return

    executionIdToLocatorCache.clear()
    executionErrorStore.clearExecutionStartErrors(runErrorKeyForJob(jobId))
    activeJobId.value = jobId
  }

  function handleExecutionCached(e: CustomEvent<ExecutionCachedWsMessage>) {
    if (!activeJob.value) return
    if (!messageMatchesActiveWorkflow(e.detail.prompt_id, e.detail.workflow_id))
      return
    for (const n of e.detail.nodes) {
      activeJob.value.nodes[n] = true
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
    if (activeJobId.value) clearInitializationByJobId(activeJobId.value)
    if (!messageMatchesActiveWorkflow(jobId, e.detail.workflow_id)) {
      // The job is finished either way, so its own records have to be released
      // or they leak for the lifetime of the session. Only the shared UI state
      // below belongs to the visible tab. Text previews stay gated: they are
      // keyed by node, and the visible graph may hold the same node ids.
      releaseFinishedJobRecords(jobId)
      return
    }
    resetExecutionState(jobId)
  }

  function handleExecuted(e: CustomEvent<ExecutedWsMessage>) {
    if (!activeJob.value) return
    if (!messageMatchesActiveWorkflow(e.detail.prompt_id, e.detail.workflow_id))
      return
    activeJob.value.nodes[e.detail.node] = true
  }

  function handleExecutionSuccess(e: CustomEvent<ExecutionSuccessWsMessage>) {
    const jobId = e.detail.prompt_id
    pendingExecutionErrorsByJobId.delete(jobId)
    clearInitializationByJobId(jobId)
    // Per-workflow status is keyed by this job's own workflow, so it is set
    // for every job — a background tab must still show Completed. Only the
    // shared execution state below is gated.
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
    if (!messageMatchesActiveWorkflow(jobId, e.detail.workflow_id)) {
      // Finished either way, so release this job's own records or they leak for
      // the session. Only the shared UI state below belongs to the visible tab,
      // and text previews stay gated because they are keyed by node and the
      // visible graph may hold the same node ids.
      releaseFinishedJobRecords(jobId)
      return
    }
    resetExecutionState(jobId)
  }

  function handleExecuting(e: CustomEvent<SerializedNodeId | null>): void {
    // The event detail is just the node id, for extension compatibility, so
    // the ids come from the raw message. Without this, the final
    // `executing: null` of a job started in another workflow tab would clear
    // the visible tab's active job and its node progress.
    const raw = api.lastExecutingMessage
    if (raw && !messageMatchesActiveWorkflow(raw.prompt_id, raw.workflow_id)) {
      return
    }

    progressCoalescer.cancel()
    if (e.detail == null) progressStateCoalescer.cancel()

    // Clear the current node progress when a new node starts executing
    _executingNodeProgress.value = null

    if (!activeJob.value) return

    if (e.detail == null) {
      activeJobId.value = null
    }
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

  const progressStateCoalescer = createRafCoalescer<ProgressStateWsMessage>(
    applyProgressState,
    'raf:progress_state'
  )

  function handleProgressState(e: CustomEvent<ProgressStateWsMessage>) {
    progressStateCoalescer.push(e.detail)
  }

  /**
   * Revoke previews for nodes that just started executing.
   *
   * Uses the *actual* node id rather than the display node id intentionally,
   * so the preview is not cleared every time a new node inside an expanded
   * graph starts.
   */
  function revokeStartedNodePreviews(
    nodes: Record<string, NodeProgressState>,
    previousForJob: Record<string, NodeProgressState>
  ) {
    const { revokePreviewsByExecutionId } = useNodeOutputStore()
    for (const nodeId in nodes) {
      if (nodes[nodeId].state !== 'running') continue
      if (previousForJob[nodeId]?.state === 'running') continue
      const executionId = tryNormalizeNodeExecutionId(nodeId)
      if (executionId) revokePreviewsByExecutionId(executionId)
    }
  }

  /** Mirror the executing node's progress for backwards compatibility. */
  function mirrorExecutingNodeProgress(
    nodes: Record<string, NodeProgressState>
  ) {
    const executingId = executingNodeId.value
    if (!executingId || !Object.hasOwn(nodes, executingId)) return
    const nodeState = nodes[executingId]
    _executingNodeProgress.value = {
      value: nodeState.value,
      max: nodeState.max,
      prompt_id: nodeState.prompt_id,
      node: nodeState.display_node_id || nodeState.node_id
    }
  }

  function applyProgressState(detail: ProgressStateWsMessage) {
    const { nodes, prompt_id: jobId, workflow_id: messageWorkflowId } = detail
    const isActiveWorkflowMessage = messageMatchesActiveWorkflow(
      jobId,
      messageWorkflowId
    )

    if (isActiveWorkflowMessage) {
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

    // Per-job state is recorded for every workflow; only the active workflow
    // writes the shared mirror the canvas reads.
    if (!isActiveWorkflowMessage) return
    nodeProgressStates.value = nodes
    mirrorExecutingNodeProgress(nodes)
  }

  /**
   * Determines whether a WebSocket execution message belongs to the
   * currently active workflow tab. Used to gate writes to the global
   * "current execution" mirror so a job initiated from another open
   * workflow cannot leak its progress into the active one.
   *
   * Resolution order:
   *  1. `workflow_id` carried on the WS message (when backend supports it).
   *  2. {@link jobIdToWorkflowId} mapping populated when the job was queued
   *     from this tab.
   *  3. {@link jobIdToSessionWorkflowPath} mapping (path-based fallback).
   *
   * When the workflow cannot be resolved at all (e.g. job queued in a
   * different browser session), the message is treated as belonging to
   * the active workflow to preserve current behaviour for the existing
   * single-tab common case.
   */
  /**
   * Graph id of the active workflow, or null when it has none.
   *
   * `LoadedComfyWorkflow` types both states as present, but the running store
   * does not always honour that, and this is read from a watcher and from a
   * computed now — so a missing state has to return null rather than throw and
   * take unrelated features down with it.
   */
  function activeWorkflowGraphId(): string | null {
    const active: Partial<LoadedComfyWorkflow> | null =
      workflowStore.activeWorkflow
    if (!active) return null
    return active.activeState?.id ?? active.initialState?.id ?? null
  }

  /**
   * A workflow id names a workflow, not an open tab, and several open tabs can
   * carry the same one: `ensureWorkflowId` keeps whatever id the json already
   * has, so copying a workflow into a new tab duplicates it, and loading one
   * can leave both a temporary and a persisted entry holding it. So the id is
   * the weakest signal here, not the strongest, and anything unique per tab has
   * to be consulted first. QA hit this with three unsaved copies of the default
   * graph, where every tab rendered every other tab's outputs.
   */
  function messageMatchesActiveWorkflow(
    jobId: JobId,
    messageWorkflowId: string | undefined
  ): boolean {
    const activeWorkflow = workflowStore.activeWorkflow
    if (!activeWorkflow) return true

    const mappedInstance = jobIdToWorkflowInstanceId.get(jobId)
    if (mappedInstance && activeWorkflow.instanceId) {
      return mappedInstance === activeWorkflow.instanceId
    }

    const mappedPath = jobIdToSessionWorkflowPath.value.get(jobId)
    if (mappedPath && activeWorkflow.path) {
      return mappedPath === activeWorkflow.path
    }

    const activeId = activeWorkflowGraphId()
    if (activeId) {
      const ownerId = messageWorkflowId || jobIdToWorkflowId.value.get(jobId)
      if (ownerId) return ownerId === activeId
    }

    return true
  }

  /**
   * Returns true when workflow ownership for {@link jobId} can be resolved
   * — either by an explicit `workflow_id` on the incoming message or by a
   * mapping registered when the job was queued. When this returns false
   * the caller should fall back to whatever legacy guard applied before
   * workflow gating was introduced.
   */
  function canResolveWorkflowOwnership(
    jobId: JobId,
    messageWorkflowId: string | undefined
  ): boolean {
    return (
      Boolean(messageWorkflowId) ||
      jobIdToWorkflowId.value.has(jobId) ||
      jobIdToSessionWorkflowPath.value.has(jobId)
    )
  }

  const progressCoalescer = createRafCoalescer<ProgressWsMessage>((detail) => {
    const { prompt_id: jobId, workflow_id: messageWorkflowId } = detail
    if (!messageMatchesActiveWorkflow(jobId, messageWorkflowId)) return
    _executingNodeProgress.value = detail
  }, 'raf:progress')

  function handleProgress(e: CustomEvent<ProgressWsMessage>) {
    progressCoalescer.push(e.detail)
  }

  function cancelPendingProgressUpdates() {
    progressCoalescer.cancel()
    progressStateCoalescer.cancel()
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
    // Only the active workflow's error resets the shared execution state; the
    // dialog is already scoped by the run error key inside showExecutionError.
    if (!messageMatchesActiveWorkflow(detail.prompt_id, detail.workflow_id))
      return

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
    if (!messageMatchesActiveWorkflow(detail.prompt_id, detail.workflow_id))
      return true

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
    const result = classifyCloudValidationError(detail.exception_message)
    if (!result) return false

    clearInitializationByJobId(detail.prompt_id)
    if (!messageMatchesActiveWorkflow(detail.prompt_id, detail.workflow_id))
      return true

    resetExecutionState(detail.prompt_id)

    if (result.kind === 'nodeErrors') {
      executionErrorStore.recordNodeErrors(result.nodeErrors, runErrorKey)
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

  /**
   * Returns the prompt_id the global {@link nodeProgressStates} mirror belongs
   * to, or null when it is empty. The mirror is replaced wholesale on every
   * `progress_state` frame, so all of its entries share one prompt_id.
   */
  function mirrorOwnerJobId(): JobId | null {
    const entries = Object.values(nodeProgressStates.value)
    if (entries.length === 0) return null
    return entries[0].prompt_id
  }

  /**
   * Evict per-job execution artifacts for a job that has reached a terminal
   * state, without disturbing state owned by a different running job.
   *
   * Unlike {@link resetExecutionState} this is safe for any jobId, including
   * one that is not {@link activeJobId}. It is the recovery path for a dropped
   * terminal WebSocket frame, which would otherwise leave node progress pinned
   * forever: the backend broadcasts `execution_success` once and never retries.
   * Idempotent.
   */
  function evictTerminalJob(jobId: JobId) {
    if (!jobId) return

    if (jobId in nodeProgressStatesByJob.value) {
      const map = { ...nodeProgressStatesByJob.value }
      delete map[jobId]
      nodeProgressStatesByJob.value = map
    }

    if (jobId in queuedJobs.value) {
      const next = { ...queuedJobs.value }
      delete next[jobId]
      queuedJobs.value = next
    }

    useJobPreviewStore().clearPreview(jobId)
    clearInitializationByJobId(jobId)
    clearTextPreviewsForJob(jobId)

    const isActive = activeJobId.value === jobId
    // Only clear the shared mirror when it still belongs to the evicted job,
    // otherwise evicting an old job would blank a live run's progress.
    if (isActive || mirrorOwnerJobId() === jobId) {
      nodeProgressStates.value = {}
      executionIdToLocatorCache.clear()
    }

    if (_executingNodeProgress.value?.prompt_id === jobId) {
      _executingNodeProgress.value = null
    }

    if (isActive) {
      activeJobId.value = null
      executionErrorStore.clearPromptError(runErrorKeyForJob(jobId))
    }
  }

  /**
   * Re-point the shared mirror at the now-active workflow's own job.
   *
   * Gating stops a background workflow's frames from *writing* the mirror, but
   * whatever was written while that workflow was in front stays there — and
   * `nodeLocationProgressStates` resolves node ids against the *currently*
   * active graph, so two workflows that share a node id will show the stale
   * entry on the newly visible node. Replay the active workflow's own per-job
   * progress instead, or clear the mirror when it has no running job.
   */
  function reconcileMirrorForActiveWorkflow() {
    const activeWorkflow = workflowStore.activeWorkflow
    if (!activeWorkflow) return

    const activeId = activeWorkflowGraphId()
    const activePath = activeWorkflow.path

    const jobIds = Object.keys(nodeProgressStatesByJob.value)
    let matchedJobId: JobId | null = null
    for (let i = jobIds.length - 1; i >= 0; i--) {
      const jobId = jobIds[i]
      const idMatch =
        activeId !== null && jobIdToWorkflowId.value.get(jobId) === activeId
      const pathMatch =
        jobIdToSessionWorkflowPath.value.get(jobId) === activePath
      if (idMatch || pathMatch) {
        matchedJobId = jobId
        break
      }
    }

    if (matchedJobId) {
      nodeProgressStates.value =
        nodeProgressStatesByJob.value[matchedJobId] ?? {}
      executionIdToLocatorCache.clear()
      if (_executingNodeProgress.value?.prompt_id !== matchedJobId) {
        _executingNodeProgress.value = null
      }
      return
    }

    if (Object.keys(nodeProgressStates.value).length > 0) {
      nodeProgressStates.value = {}
      executionIdToLocatorCache.clear()
    }
    _executingNodeProgress.value = null
  }

  watch(
    () => workflowStore.activeWorkflow,
    () => {
      reconcileMirrorForActiveWorkflow()
    }
  )

  /**
   * Reconcile tracked per-job state against the backend's authoritative job
   * sets. A job the backend reports as terminal but which still holds progress
   * state lost its terminal frame, so evict it.
   *
   * @param activeJobIds jobs the backend reports as Running or Pending
   * @param terminalJobIds jobs the backend reports in history
   */
  function reconcileTerminalJobs(
    activeJobIds: Set<JobId>,
    terminalJobIds: Set<JobId>
  ) {
    const tracked = new Set<JobId>([
      ...Object.keys(nodeProgressStatesByJob.value),
      ...initializingJobIds.value
    ])
    if (activeJobId.value) tracked.add(activeJobId.value)

    for (const jobId of tracked) {
      if (activeJobIds.has(jobId)) continue
      if (!terminalJobIds.has(jobId)) continue
      evictTerminalJob(jobId)
    }
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

  function isJobInitializing(jobId: JobId | number | undefined): boolean {
    if (!jobId) return false
    return initializingJobIds.value.has(String(jobId))
  }

  /**
   * Removes any leftover `progress_text` preview widget from every node that
   * ran in this job, so a node's completed status line doesn't stick around
   * and starve other widgets of the node's height on the next run.
   */
  function clearTextPreviewsForJob(jobId: JobId) {
    if (!(jobId in queuedJobs.value)) return
    const job = queuedJobs.value[jobId]
    if (!job.workflow || job.workflow !== workflowStore.activeWorkflow) return

    const { removeTextPreview } = useNodeProgressText()
    for (const nodeId of Object.keys(job.nodes)) {
      const currentId = workflowStore.executionIdToCurrentId(nodeId)
      if (!currentId) continue
      const parsedCurrentId = parseNodeId(currentId)
      if (!parsedCurrentId) continue
      const node = canvasStore.canvas?.graph?.getNodeById(parsedCurrentId)
      if (node) removeTextPreview(node)
    }
  }

  /**
   * Reset execution-related state after a run completes or is stopped.
   */
  function releaseFinishedJobRecords(jobId: JobId) {
    if (jobId in queuedJobs.value) delete queuedJobs.value[jobId]
    if (jobId in nodeProgressStatesByJob.value) {
      const map = { ...nodeProgressStatesByJob.value }
      delete map[jobId]
      nodeProgressStatesByJob.value = map
    }
    jobIdToWorkflow.delete(jobId)
    useJobPreviewStore().clearPreview(jobId)
  }

  function resetExecutionState(jobIdParam?: JobId | null) {
    cancelPendingProgressUpdates()

    executionIdToLocatorCache.clear()
    nodeProgressStates.value = {}
    const jobId = jobIdParam ?? activeJobId.value ?? null
    const runErrorKey = jobId ? runErrorKeyForJob(jobId) : undefined
    if (jobId) {
      const map = { ...nodeProgressStatesByJob.value }
      delete map[jobId]
      nodeProgressStatesByJob.value = map
      useJobPreviewStore().clearPreview(jobId)
      jobIdToWorkflow.delete(jobId)
      clearTextPreviewsForJob(jobId)
    }
    if (jobId) delete queuedJobs.value[jobId]
    activeJobId.value = null
    _executingNodeProgress.value = null
    executionErrorStore.clearPromptError(runErrorKey)
  }

  function getNodeIdIfExecuting(nodeId: string | number) {
    const nodeIdStr = String(nodeId)
    return nodeIdStr.includes(':')
      ? workflowStore.executionIdToCurrentId(nodeIdStr)
      : nodeIdStr
  }

  /**
   * Whether a text preview belongs on the visible canvas.
   *
   * Prefers the workflow-ownership gate and falls back to the legacy
   * active-prompt guard only when ownership is unresolvable: activeJobId can
   * point at another workflow's job, which would otherwise drop frames for the
   * workflow the user is looking at.
   *
   * Exported because node outputs are applied outside this store, in ComfyApp's
   * own `executed` listener, which resolves the execution id against the
   * visible graph. Without this gate a finished job writes its output onto the
   * same-numbered node of whatever tab is in front.
   */
  function frameBelongsToVisibleWorkflow(
    promptId: string | undefined,
    workflowId: string | undefined
  ): boolean {
    if (!promptId) return true
    if (canResolveWorkflowOwnership(promptId, workflowId)) {
      return messageMatchesActiveWorkflow(promptId, workflowId)
    }
    return !activeJobId.value || promptId === activeJobId.value
  }

  function handleProgressText(e: CustomEvent<ProgressTextWsMessage>) {
    const { nodeId, text, prompt_id, workflow_id } = e.detail
    if (!text || !nodeId) return
    if (!frameBelongsToVisibleWorkflow(prompt_id, workflow_id)) return

    const currentId = getNodeIdIfExecuting(nodeId)
    if (!currentId) return
    const parsedCurrentId = parseNodeId(currentId)
    if (!parsedCurrentId) return
    const node = canvasStore.canvas?.graph?.getNodeById(parsedCurrentId)
    if (!node) return

    useNodeProgressText().showTextPreview(node, text)
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
    queuedJob.workflow = workflow
    jobIdToWorkflow.set(id, workflow)
    queuedJob.shareId = workflow.shareId
    queuedJob.viewMode = mode
    queuedJob.isAppMode = isAppModeValue(mode)
    const wid = workflow.activeState?.id ?? workflow.initialState?.id
    if (wid) {
      jobIdToWorkflowId.value.set(id, wid)
    }
    if (workflow.path) {
      ensureSessionWorkflowPath(id, workflow.path, workflow.instanceId)
    }
    flushPendingWorkflowStatus(id, workflow)
    flushPendingExecutionError(id)
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

  /**
   * Register or update a mapping from job ID to workflow ID.
   */
  function registerJobWorkflowIdMapping(jobId: JobId, workflowId: WorkflowId) {
    if (!jobId || !workflowId) return
    jobIdToWorkflowId.value.set(jobId, workflowId)
    flushPendingExecutionError(jobId)
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
      if (Object.values(nodes).some((n) => n.state === 'running')) {
        result.push(pid)
      }
    }
    return result
  })

  const runningWorkflowCount = computed<number>(
    () => runningJobIds.value.length
  )

  const isActiveWorkflowRunning = computed(() => {
    if (!activeJobId.value) return false
    const path = workflowStore.activeWorkflow?.path
    if (!path) return false
    return jobIdToSessionWorkflowPath.value.get(activeJobId.value) === path
  })

  return {
    isIdle,
    clientId,
    activeJobId,
    queuedJobs,
    executingNodeId,
    executingNodeIds,
    activeJob,
    totalNodesToExecute,
    nodesExecuted,
    executionProgress,
    executingNode,
    executingNodeProgress,
    nodeProgressStates,
    nodeLocationProgressStates,
    nodeProgressStatesByJob,
    runningJobIds,
    runningWorkflowCount,
    initializingJobIds,
    isActiveWorkflowRunning,
    isJobInitializing,
    clearInitializationByJobId,
    clearInitializationByJobIds,
    reconcileInitializingJobs,
    reconcileTerminalJobs,
    reconcileMirrorForActiveWorkflow,
    clearActiveJobIfStale,
    bindExecutionEvents,
    unbindExecutionEvents,
    storeJob,
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
    clearWorkflowStatus,
    rewriteSessionWorkflowPaths,
    frameBelongsToVisibleWorkflow
  }
})
