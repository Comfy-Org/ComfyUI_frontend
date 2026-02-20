import { defineStore } from 'pinia'
import { computed, ref, watch } from 'vue'

import { useNodeProgressText } from '@/composables/node/useNodeProgressText'
import type { LGraph, Subgraph } from '@/lib/litegraph/src/litegraph'
import { isCloud } from '@/platform/distribution/types'
import { useTelemetry } from '@/platform/telemetry'
import type { ComfyWorkflow } from '@/platform/workflow/management/stores/workflowStore'
import { useWorkflowStore } from '@/platform/workflow/management/stores/workflowStore'
import type {
  ComfyNode,
  ComfyWorkflowJSON,
  NodeId
} from '@/platform/workflow/validation/schemas/workflowSchema'
import { useCanvasStore } from '@/renderer/core/canvas/canvasStore'
import type {
  ExecutedWsMessage,
  ExecutionCachedWsMessage,
  ExecutionErrorWsMessage,
  ExecutionInterruptedWsMessage,
  ExecutionStartWsMessage,
  ExecutionSuccessWsMessage,
  NodeError,
  NodeProgressState,
  NotificationWsMessage,
  ProgressStateWsMessage,
  ProgressTextWsMessage,
  ProgressWsMessage,
  PromptError
} from '@/schemas/apiSchema'
import { api } from '@/scripts/api'
import { app } from '@/scripts/app'
import { useNodeOutputStore } from '@/stores/imagePreviewStore'
import { useJobPreviewStore } from '@/stores/jobPreviewStore'
import type { NodeLocatorId } from '@/types/nodeIdentification'
import { createNodeLocatorId } from '@/types/nodeIdentification'
import { forEachNode, getNodeByExecutionId } from '@/utils/graphTraversalUtil'
import { classifyCloudValidationError } from '@/utils/executionErrorUtil'

interface QueuedJob {
  /**
   * The nodes that are queued to be executed. The key is the node id and the
   * value is a boolean indicating if the node has been executed.
   */
  nodes: Record<NodeId, boolean>
  /**
   * The workflow that is queued to be executed
   */
  workflow?: ComfyWorkflow
}

export type WorkflowExecutionResult = {
  state: 'completed' | 'error'
  timestamp: number
  promptId?: string
}

export type WorkflowExecutionState = 'idle' | 'running' | 'completed' | 'error'

const subgraphNodeIdToSubgraph = (id: string, graph: LGraph | Subgraph) => {
  const node = graph.getNodeById(id)
  if (node?.isSubgraphNode()) return node.subgraph
}

/**
 * Recursively get the subgraph objects for the given subgraph instance IDs
 * @param currentGraph The current graph
 * @param subgraphNodeIds The instance IDs
 * @param subgraphs The subgraphs
 * @returns The subgraphs that correspond to each of the instance IDs.
 */
function getSubgraphsFromInstanceIds(
  currentGraph: LGraph | Subgraph,
  subgraphNodeIds: string[],
  subgraphs: Subgraph[] = []
): Subgraph[] | undefined {
  // Last segment is the node portion; nothing to do.
  if (subgraphNodeIds.length === 1) return subgraphs

  const currentPart = subgraphNodeIds.shift()
  if (currentPart === undefined) return subgraphs

  const subgraph = subgraphNodeIdToSubgraph(currentPart, currentGraph)
  if (!subgraph) {
    console.warn(`Subgraph not found: ${currentPart}`)
    return undefined
  }

  subgraphs.push(subgraph)
  return getSubgraphsFromInstanceIds(subgraph, subgraphNodeIds, subgraphs)
}

/**
 * Convert execution context node IDs to NodeLocatorIds
 * @param nodeId The node ID from execution context (could be execution ID)
 * @returns The NodeLocatorId
 */
function executionIdToNodeLocatorId(
  nodeId: string | number
): NodeLocatorId | undefined {
  const nodeIdStr = String(nodeId)

  if (!nodeIdStr.includes(':')) {
    // It's a top-level node ID
    return nodeIdStr
  }

  // It's an execution node ID
  const parts = nodeIdStr.split(':')
  const localNodeId = parts[parts.length - 1]
  const subgraphs = getSubgraphsFromInstanceIds(app.rootGraph, parts)
  if (!subgraphs) return undefined
  const nodeLocatorId = createNodeLocatorId(subgraphs.at(-1)!.id, localNodeId)
  return nodeLocatorId
}

export const useExecutionStore = defineStore('execution', () => {
  const workflowStore = useWorkflowStore()
  const canvasStore = useCanvasStore()

  const clientId = ref<string | null>(null)
  const activeJobId = ref<string | null>(null)
  const queuedJobs = ref<Record<NodeId, QueuedJob>>({})
  const lastNodeErrors = ref<Record<NodeId, NodeError> | null>(null)
  const lastExecutionError = ref<ExecutionErrorWsMessage | null>(null)
  const lastPromptError = ref<PromptError | null>(null)
  // This is the progress of all nodes in the currently executing workflow
  const nodeProgressStates = ref<Record<string, NodeProgressState>>({})
  const nodeProgressStatesByJob = ref<
    Record<string, Record<string, NodeProgressState>>
  >({})

  /**
   * Map of job ID to workflow ID for quick lookup across the app.
   */
  const jobIdToWorkflowId = ref<Map<string, string>>(new Map())

  const initializingJobIds = ref<Set<string>>(new Set())

  /**
   * Map of workflow ID to last execution result for UI state display.
   */
  const lastExecutionResultByWorkflowId = ref<
    Map<string, WorkflowExecutionResult>
  >(new Map())

  function clearWorkflowExecutionResult(workflowId: string) {
    if (!lastExecutionResultByWorkflowId.value.has(workflowId)) return
    const next = new Map(lastExecutionResultByWorkflowId.value)
    next.delete(workflowId)
    lastExecutionResultByWorkflowId.value = next
  }

  function setWorkflowExecutionResult(
    promptId: string,
    state: 'completed' | 'error'
  ) {
    const wid = jobIdToWorkflowId.value.get(promptId)
    if (!wid) {
      console.warn(
        `[executionStore] No workflow mapping for prompt ${promptId}, execution result '${state}' dropped`
      )
      return
    }
    setWorkflowExecutionResultByWorkflowId(wid, state, promptId)
  }

  function setWorkflowExecutionResultByWorkflowId(
    workflowId: string,
    state: 'completed' | 'error',
    promptId?: string
  ) {
    const next = new Map(lastExecutionResultByWorkflowId.value)
    next.set(workflowId, {
      state,
      timestamp: Date.now(),
      promptId
    })
    lastExecutionResultByWorkflowId.value = next
  }

  function batchSetWorkflowExecutionResults(
    results: Map<string, WorkflowExecutionResult>
  ) {
    if (results.size === 0) return
    const next = new Map(lastExecutionResultByWorkflowId.value)
    for (const [workflowId, result] of results) {
      next.set(workflowId, result)
    }
    lastExecutionResultByWorkflowId.value = next
  }

  /**
   * Computed map of workflow ID to execution state for reactive UI updates.
   */
  const workflowExecutionStates = computed<Map<string, WorkflowExecutionState>>(
    () => {
      const states = new Map<string, WorkflowExecutionState>()

      // Mark running workflows
      for (const jobId of runningJobIds.value) {
        const workflowId = jobIdToWorkflowId.value.get(jobId)
        if (workflowId) {
          states.set(workflowId, 'running')
        }
      }

      // Add completed/error states for workflows not currently running
      for (const [
        workflowId,
        result
      ] of lastExecutionResultByWorkflowId.value) {
        if (!states.has(workflowId)) {
          states.set(workflowId, result.state)
        }
      }

      return states
    }
  )

  function getWorkflowExecutionState(
    workflowId: string | undefined
  ): WorkflowExecutionState {
    if (!workflowId) return 'idle'
    return workflowExecutionStates.value.get(workflowId) ?? 'idle'
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
        const locatorId = executionIdToNodeLocatorId(executionId)
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
  const executingNodeIds = computed<NodeId[]>(() => {
    return Object.entries(nodeProgressStates.value)
      .filter(([_, state]) => state.state === 'running')
      .map(([nodeId, _]) => nodeId)
  })

  // @deprecated For backward compatibility - stores the primary executing node ID
  const executingNodeId = computed<NodeId | null>(() => {
    return executingNodeIds.value[0] ?? null
  })

  const uniqueExecutingNodeIdStrings = computed(
    () => new Set(executingNodeIds.value.map(String))
  )

  // For backward compatibility - returns the primary executing node
  const executingNode = computed<ComfyNode | null>(() => {
    if (!executingNodeId.value) return null

    const workflow: ComfyWorkflow | undefined = activeJob.value?.workflow
    if (!workflow) return null

    const canvasState: ComfyWorkflowJSON | null =
      workflow.changeTracker?.activeState ?? null
    if (!canvasState) return null

    return (
      canvasState.nodes.find((n) => String(n.id) === executingNodeId.value) ??
      null
    )
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

  const lastExecutionErrorNodeLocatorId = computed(() => {
    const err = lastExecutionError.value
    if (!err) return null
    return executionIdToNodeLocatorId(String(err.node_id))
  })

  const lastExecutionErrorNodeId = computed(() => {
    const locator = lastExecutionErrorNodeLocatorId.value
    if (!locator) return null
    const localId = workflowStore.nodeLocatorIdToNodeId(locator)
    return localId != null ? String(localId) : null
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
  }

  function handleExecutionStart(e: CustomEvent<ExecutionStartWsMessage>) {
    lastExecutionError.value = null
    lastPromptError.value = null
    lastNodeErrors.value = null
    isErrorOverlayOpen.value = false
    activeJobId.value = e.detail.prompt_id
    queuedJobs.value[activeJobId.value] ??= { nodes: {} }
    clearInitializationByJobId(activeJobId.value)
  }

  function handleExecutionCached(e: CustomEvent<ExecutionCachedWsMessage>) {
    if (!activeJob.value) return
    for (const n of e.detail.nodes) {
      activeJob.value.nodes[n] = true
    }
  }

  function handleExecutionInterrupted(
    e: CustomEvent<ExecutionInterruptedWsMessage>
  ) {
    const jobId = e.detail.prompt_id
    if (activeJobId.value) clearInitializationByJobId(activeJobId.value)
    resetExecutionState(jobId)
  }

  function handleExecuted(e: CustomEvent<ExecutedWsMessage>) {
    if (!activeJob.value) return
    activeJob.value.nodes[e.detail.node] = true
  }

  function handleExecutionSuccess(e: CustomEvent<ExecutionSuccessWsMessage>) {
    const pid = e.detail.prompt_id
    setWorkflowExecutionResult(pid, 'completed')
    if (isCloud && activeJobId.value) {
      useTelemetry()?.trackExecutionSuccess({
        jobId: activeJobId.value
      })
    }
    resetExecutionState(pid)
  }

  function handleExecuting(e: CustomEvent<NodeId | null>): void {
    // Clear the current node progress when a new node starts executing
    _executingNodeProgress.value = null

    if (!activeJob.value) return

    // Update the executing nodes list
    if (typeof e.detail !== 'string') {
      if (activeJobId.value) {
        delete queuedJobs.value[activeJobId.value]
      }
      activeJobId.value = null
    }
  }

  function handleProgressState(e: CustomEvent<ProgressStateWsMessage>) {
    const { nodes, prompt_id: jobId } = e.detail

    // Revoke previews for nodes that are starting to execute
    const previousForJob = nodeProgressStatesByJob.value[jobId] || {}
    for (const nodeId in nodes) {
      const nodeState = nodes[nodeId]
      if (nodeState.state === 'running' && !previousForJob[nodeId]) {
        // This node just started executing, revoke its previews
        // Note that we're doing the *actual* node id instead of the display node id
        // here intentionally. That way, we don't clear the preview every time a new node
        // within an expanded graph starts executing.
        const { revokePreviewsByExecutionId } = useNodeOutputStore()
        revokePreviewsByExecutionId(nodeId)
      }
    }

    // Update the progress states for all nodes
    nodeProgressStatesByJob.value = {
      ...nodeProgressStatesByJob.value,
      [jobId]: nodes
    }
    nodeProgressStates.value = nodes

    // If we have progress for the currently executing node, update it for backwards compatibility
    if (executingNodeId.value && nodes[executingNodeId.value]) {
      const nodeState = nodes[executingNodeId.value]
      _executingNodeProgress.value = {
        value: nodeState.value,
        max: nodeState.max,
        prompt_id: nodeState.prompt_id,
        node: nodeState.display_node_id || nodeState.node_id
      }
    }
  }

  function handleProgress(e: CustomEvent<ProgressWsMessage>) {
    _executingNodeProgress.value = e.detail
  }

  function handleStatus() {
    if (api.clientId) {
      clientId.value = api.clientId

      // Once we've received the clientId we no longer need to listen
      api.removeEventListener('status', handleStatus)
    }
  }

  function handleExecutionError(e: CustomEvent<ExecutionErrorWsMessage>) {
    setWorkflowExecutionResult(e.detail.prompt_id, 'error')
    if (isCloud) {
      useTelemetry()?.trackExecutionError({
        jobId: e.detail.prompt_id,
        nodeId: String(e.detail.node_id),
        nodeType: e.detail.node_type,
        error: e.detail.exception_message
      })

      // Cloud wraps validation errors (400) in exception_message as embedded JSON.
      if (handleCloudValidationError(e.detail)) return
    }

    // Service-level errors (e.g. "Job has stagnated") have no associated node.
    // Route them as job errors
    if (handleServiceLevelError(e.detail)) return

    // OSS path / Cloud fallback (real runtime errors)
    lastExecutionError.value = e.detail
    clearInitializationByJobId(e.detail.prompt_id)
    resetExecutionState(e.detail.prompt_id)
  }

  function handleServiceLevelError(detail: ExecutionErrorWsMessage): boolean {
    const nodeId = detail.node_id
    if (nodeId !== null && nodeId !== undefined && String(nodeId) !== '')
      return false

    clearInitializationByJobId(detail.prompt_id)
    resetExecutionState(detail.prompt_id)
    lastPromptError.value = {
      type: detail.exception_type ?? 'error',
      message: detail.exception_type
        ? `${detail.exception_type}: ${detail.exception_message}`
        : (detail.exception_message ?? ''),
      details: detail.traceback?.join('\n') ?? ''
    }
    return true
  }

  function handleCloudValidationError(
    detail: ExecutionErrorWsMessage
  ): boolean {
    const result = classifyCloudValidationError(detail.exception_message)
    if (!result) return false

    clearInitializationByJobId(detail.prompt_id)
    resetExecutionState(detail.prompt_id)

    if (result.kind === 'nodeErrors') {
      lastNodeErrors.value = result.nodeErrors
    } else {
      lastPromptError.value = result.promptError
    }
    return true
  }

  /**
   * Notification handler used for frontend/cloud initialization tracking.
   * Marks a job as initializing when cloud notifies it is waiting for a machine.
   */
  function handleNotification(e: CustomEvent<NotificationWsMessage>) {
    const payload = e.detail
    const text = payload?.value || ''
    const id = payload?.id ? payload.id : ''
    if (!id) return
    // Until cloud implements a proper message
    if (text.includes('Waiting for a machine')) {
      const next = new Set(initializingJobIds.value)
      next.add(id)
      initializingJobIds.value = next
    }
  }

  function clearInitializationByJobId(jobId: string | null) {
    if (!jobId) return
    if (!initializingJobIds.value.has(jobId)) return
    const next = new Set(initializingJobIds.value)
    next.delete(jobId)
    initializingJobIds.value = next
  }

  function clearInitializationByJobIds(jobIds: string[]) {
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

  function reconcileInitializingJobs(activeJobIds: Set<string>) {
    const orphaned = [...initializingJobIds.value].filter(
      (id) => !activeJobIds.has(id)
    )
    clearInitializationByJobIds(orphaned)
  }

  function isJobInitializing(jobId: string | number | undefined): boolean {
    if (!jobId) return false
    return initializingJobIds.value.has(String(jobId))
  }

  /**
   * Reset execution-related state after a run completes or is stopped.
   */
  function resetExecutionState(jobIdParam?: string | null) {
    nodeProgressStates.value = {}
    const jobId = jobIdParam ?? activeJobId.value ?? null
    if (jobId) {
      const map = { ...nodeProgressStatesByJob.value }
      delete map[jobId]
      nodeProgressStatesByJob.value = map
      useJobPreviewStore().clearPreview(jobId)
      jobIdToWorkflowId.value.delete(jobId)
    }
    if (activeJobId.value) {
      delete queuedJobs.value[activeJobId.value]
    }
    activeJobId.value = null
    _executingNodeProgress.value = null
    lastPromptError.value = null
  }

  function getNodeIdIfExecuting(nodeId: string | number) {
    const nodeIdStr = String(nodeId)
    return nodeIdStr.includes(':')
      ? workflowStore.executionIdToCurrentId(nodeIdStr)
      : nodeIdStr
  }

  function handleProgressText(e: CustomEvent<ProgressTextWsMessage>) {
    const { nodeId, text } = e.detail
    if (!text || !nodeId) return

    // Handle execution node IDs for subgraphs
    const currentId = getNodeIdIfExecuting(nodeId)
    const node = canvasStore.getCanvas().graph?.getNodeById(currentId)
    if (!node) return

    useNodeProgressText().showTextPreview(node, text)
  }

  function storeJob({
    nodes,
    id,
    workflow
  }: {
    nodes: string[]
    id: string
    workflow: ComfyWorkflow
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
    queuedJob.workflow = workflow
    const wid = workflow?.activeState?.id ?? workflow?.initialState?.id
    if (wid) {
      jobIdToWorkflowId.value.set(String(id), String(wid))
    }
  }

  /**
   * Register or update a mapping from job ID to workflow ID.
   */
  function registerJobWorkflowIdMapping(jobId: string, workflowId: string) {
    if (!jobId || !workflowId) return
    jobIdToWorkflowId.value.set(String(jobId), String(workflowId))
  }

  /**
   * Convert a NodeLocatorId to an execution context ID
   * @param locatorId The NodeLocatorId
   * @returns The execution ID or null if conversion fails
   */
  const nodeLocatorIdToExecutionId = (
    locatorId: NodeLocatorId | string
  ): string | null => {
    const executionId = workflowStore.nodeLocatorIdToNodeExecutionId(locatorId)
    return executionId
  }

  const runningJobIds = computed<string[]>(() => {
    const result: string[] = []
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

  /** Map of node errors indexed by locator ID. */
  const nodeErrorsByLocatorId = computed<Record<NodeLocatorId, NodeError>>(
    () => {
      if (!lastNodeErrors.value) return {}

      const map: Record<NodeLocatorId, NodeError> = {}

      for (const [executionId, nodeError] of Object.entries(
        lastNodeErrors.value
      )) {
        const locatorId = executionIdToNodeLocatorId(executionId)
        if (locatorId) {
          map[locatorId] = nodeError
        }
      }

      return map
    }
  )

  /** Get node errors by locator ID. */
  const getNodeErrors = (
    nodeLocatorId: NodeLocatorId
  ): NodeError | undefined => {
    return nodeErrorsByLocatorId.value[nodeLocatorId]
  }

  /** Check if a specific slot has validation errors. */
  const slotHasError = (
    nodeLocatorId: NodeLocatorId,
    slotName: string
  ): boolean => {
    const nodeError = getNodeErrors(nodeLocatorId)
    if (!nodeError) return false

    return nodeError.errors.some((e) => e.extra_info?.input_name === slotName)
  }

  /**
   * Update node and slot error flags when validation errors change.
   * Propagates errors up subgraph chains.
   */
  watch(lastNodeErrors, () => {
    if (!app.rootGraph) return

    // Clear all error flags
    forEachNode(app.rootGraph, (node) => {
      node.has_errors = false
      if (node.inputs) {
        for (const slot of node.inputs) {
          slot.hasErrors = false
        }
      }
    })

    if (!lastNodeErrors.value) return

    // Set error flags on nodes and slots
    for (const [executionId, nodeError] of Object.entries(
      lastNodeErrors.value
    )) {
      const node = getNodeByExecutionId(app.rootGraph, executionId)
      if (!node) continue

      node.has_errors = true

      // Mark input slots with errors
      if (node.inputs) {
        for (const error of nodeError.errors) {
          const slotName = error.extra_info?.input_name
          if (!slotName) continue

          const slot = node.inputs.find((s) => s.name === slotName)
          if (slot) {
            slot.hasErrors = true
          }
        }
      }

      // Propagate errors to parent subgraph nodes
      const parts = executionId.split(':')
      for (let i = parts.length - 1; i > 0; i--) {
        const parentExecutionId = parts.slice(0, i).join(':')
        const parentNode = getNodeByExecutionId(
          app.rootGraph,
          parentExecutionId
        )
        if (parentNode) {
          parentNode.has_errors = true
        }
      }
    }
  })

  /** Whether a runtime execution error is present */
  const hasExecutionError = computed(() => !!lastExecutionError.value)

  /** Whether a prompt-level error is present (e.g. invalid_prompt, prompt_no_outputs) */
  const hasPromptError = computed(() => !!lastPromptError.value)

  /** Whether any node validation errors are present */
  const hasNodeError = computed(
    () => !!lastNodeErrors.value && Object.keys(lastNodeErrors.value).length > 0
  )

  /** Whether any error (node validation, runtime execution, or prompt-level) is present */
  const hasAnyError = computed(
    () => hasExecutionError.value || hasPromptError.value || hasNodeError.value
  )

  const allErrorExecutionIds = computed<string[]>(() => {
    const ids: string[] = []
    if (lastNodeErrors.value) {
      ids.push(...Object.keys(lastNodeErrors.value))
    }
    if (lastExecutionError.value) {
      const nodeId = lastExecutionError.value.node_id
      if (nodeId !== null && nodeId !== undefined) {
        ids.push(String(nodeId))
      }
    }
    return ids
  })

  /** Count of prompt-level errors (0 or 1) */
  const promptErrorCount = computed(() => (lastPromptError.value ? 1 : 0))

  /** Count of all individual node validation errors */
  const nodeErrorCount = computed(() => {
    if (!lastNodeErrors.value) return 0
    let count = 0
    for (const nodeError of Object.values(lastNodeErrors.value)) {
      count += nodeError.errors.length
    }
    return count
  })

  /** Count of runtime execution errors (0 or 1) */
  const executionErrorCount = computed(() => (lastExecutionError.value ? 1 : 0))

  /** Total count of all individual errors */
  const totalErrorCount = computed(
    () =>
      promptErrorCount.value + nodeErrorCount.value + executionErrorCount.value
  )

  /** Pre-computed Set of graph node IDs (as strings) that have errors in the current graph scope. */
  const activeGraphErrorNodeIds = computed<Set<string>>(() => {
    const ids = new Set<string>()
    if (!app.rootGraph) return ids

    // Fall back to rootGraph when currentGraph hasn't been initialized yet
    const activeGraph = canvasStore.currentGraph ?? app.rootGraph

    if (lastNodeErrors.value) {
      for (const executionId of Object.keys(lastNodeErrors.value)) {
        const graphNode = getNodeByExecutionId(app.rootGraph, executionId)
        if (graphNode?.graph === activeGraph) {
          ids.add(String(graphNode.id))
        }
      }
    }

    if (lastExecutionError.value) {
      const execNodeId = String(lastExecutionError.value.node_id)
      const graphNode = getNodeByExecutionId(app.rootGraph, execNodeId)
      if (graphNode?.graph === activeGraph) {
        ids.add(String(graphNode.id))
      }
    }

    return ids
  })

  function hasInternalErrorForNode(nodeId: string | number): boolean {
    const prefix = `${nodeId}:`
    return allErrorExecutionIds.value.some((id) => id.startsWith(prefix))
  }

  const isErrorOverlayOpen = ref(false)

  function showErrorOverlay() {
    isErrorOverlayOpen.value = true
  }

  function dismissErrorOverlay() {
    isErrorOverlayOpen.value = false
  }

  return {
    isIdle,
    clientId,
    activeJobId,
    queuedJobs,
    lastNodeErrors,
    lastExecutionError,
    lastPromptError,
    hasAnyError,
    allErrorExecutionIds,
    totalErrorCount,
    lastExecutionErrorNodeId,
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
    isJobInitializing,
    clearInitializationByJobId,
    clearInitializationByJobIds,
    reconcileInitializingJobs,
    bindExecutionEvents,
    unbindExecutionEvents,
    storeJob,
    registerJobWorkflowIdMapping,
    uniqueExecutingNodeIdStrings,
    // Raw executing progress data for backward compatibility in ComfyApp.
    _executingNodeProgress,
    // NodeLocatorId conversion helpers
    executionIdToNodeLocatorId,
    nodeLocatorIdToExecutionId,
    jobIdToWorkflowId,
    // Node error lookup helpers
    getNodeErrors,
    slotHasError,
    hasInternalErrorForNode,
    activeGraphErrorNodeIds,
    isErrorOverlayOpen,
    showErrorOverlay,
    dismissErrorOverlay,
    // Workflow execution result tracking
    clearWorkflowExecutionResult,
    setWorkflowExecutionResultByWorkflowId,
    batchSetWorkflowExecutionResults,
    getWorkflowExecutionResult,
    workflowExecutionStates,
    getWorkflowExecutionState
  }
})
