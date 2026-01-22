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
  ExecutingWsMessage,
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
  ProgressWsMessage
} from '@/schemas/apiSchema'
import { api } from '@/scripts/api'
import { app } from '@/scripts/app'
import { useNodeOutputStore } from '@/stores/imagePreviewStore'
import type { NodeLocatorId } from '@/types/nodeIdentification'
import { createNodeLocatorId } from '@/types/nodeIdentification'
import { forEachNode, getNodeByExecutionId } from '@/utils/graphTraversalUtil'

interface QueuedPrompt {
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

interface PromptExecutionState extends QueuedPrompt {
  nodeProgressStates: Record<string, NodeProgressState>
  executingNodeProgress: ProgressWsMessage | null
  isRunning: boolean
  startedAt?: number
  lastUpdatedAt: number
}

type PromptProgress = {
  totalNodes: number
  executedNodes: number
  progress: number
}

type ExecutingEventDetail =
  | ExecutingWsMessage
  | {
      node: NodeId | null
      display_node?: NodeId
      prompt_id?: string | null
    }
  | NodeId
  | null

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
  const promptStates = ref<Record<string, PromptExecutionState>>({})
  const lastStartedPromptId = ref<string | null>(null)
  const lastNodeErrors = ref<Record<NodeId, NodeError> | null>(null)
  const lastExecutionError = ref<ExecutionErrorWsMessage | null>(null)

  /**
   * Map of prompt_id to workflow ID for quick lookup across the app.
   */
  const promptIdToWorkflowId = ref<Map<string, string>>(new Map())

  const initializingPromptIds = ref<Set<string>>(new Set())

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

  const createPromptState = (startedAt?: number): PromptExecutionState => ({
    nodes: {},
    nodeProgressStates: {},
    executingNodeProgress: null,
    isRunning: false,
    startedAt,
    lastUpdatedAt: startedAt ?? Date.now()
  })

  const getPromptState = (
    promptId: string | number | null | undefined
  ): PromptExecutionState | undefined => {
    if (!promptId) return undefined
    return promptStates.value[String(promptId)]
  }

  const ensurePromptState = (
    promptId: string,
    startedAt?: number
  ): PromptExecutionState => {
    const existing = promptStates.value[promptId]
    if (existing) {
      if (startedAt && !existing.startedAt) {
        existing.startedAt = startedAt
      }
      return existing
    }

    const nextState = createPromptState(startedAt)
    promptStates.value = {
      ...promptStates.value,
      [promptId]: nextState
    }
    return nextState
  }

  const touchPromptState = (
    promptState: PromptExecutionState,
    timestamp?: number
  ) => {
    promptState.lastUpdatedAt = timestamp ?? Date.now()
  }

  const isPromptRunning = (promptState: PromptExecutionState) =>
    promptState.isRunning ||
    Object.values(promptState.nodeProgressStates).some(
      (node) => node.state === 'running'
    )

  const getPromptSortTimestamp = (promptState: PromptExecutionState) =>
    promptState.startedAt ?? promptState.lastUpdatedAt ?? 0

  const getMostRecentPromptId = (promptIds: string[]): string | null => {
    let bestPromptId: string | null = null
    let bestTimestamp = -1
    for (const promptId of promptIds) {
      const state = promptStates.value[promptId]
      if (!state) continue
      const timestamp = getPromptSortTimestamp(state)
      if (timestamp >= bestTimestamp) {
        bestTimestamp = timestamp
        bestPromptId = promptId
      }
    }
    return bestPromptId
  }

  const activeWorkflowId = computed(() => {
    const activeWorkflow = workflowStore.activeWorkflow
    return (
      activeWorkflow?.activeState?.id ??
      activeWorkflow?.initialState?.id ??
      null
    )
  })

  const applyNodeProgressStatesByPrompt = (
    next: Record<string, Record<string, NodeProgressState>>
  ) => {
    const nextStates: Record<string, PromptExecutionState> = {}
    for (const [promptId, nodes] of Object.entries(next)) {
      const current = promptStates.value[promptId]
      const hasRunningNode = Object.values(nodes).some(
        (node) => node.state === 'running'
      )
      nextStates[promptId] = {
        nodes: current?.nodes ?? {},
        workflow: current?.workflow,
        nodeProgressStates: nodes,
        executingNodeProgress: current?.executingNodeProgress ?? null,
        isRunning: (current?.isRunning ?? false) || hasRunningNode,
        startedAt: current?.startedAt,
        lastUpdatedAt: Date.now()
      }
    }
    promptStates.value = nextStates
  }

  const nodeProgressStatesByPrompt = computed<
    Record<string, Record<string, NodeProgressState>>
  >({
    get: () => {
      const result: Record<string, Record<string, NodeProgressState>> = {}
      for (const [promptId, state] of Object.entries(promptStates.value)) {
        result[promptId] = state.nodeProgressStates
      }
      return result
    },
    set: (next) => applyNodeProgressStatesByPrompt(next)
  })

  const setNodeProgressStatesByPrompt = (
    next: Record<string, Record<string, NodeProgressState>>
  ) => {
    applyNodeProgressStatesByPrompt(next)
  }

  const getPromptNodeProgressStates = (
    promptId: string | number | null | undefined
  ): Record<string, NodeProgressState> =>
    getPromptState(promptId)?.nodeProgressStates ?? {}

  const getPromptProgress = (
    promptId: string | number | null | undefined
  ): PromptProgress | null => {
    const promptState = getPromptState(promptId)
    if (!promptState) return null
    const totalNodes = Object.values(promptState.nodes).length
    const executedNodes = Object.values(promptState.nodes).filter(
      Boolean
    ).length
    return {
      totalNodes,
      executedNodes,
      progress: totalNodes > 0 ? executedNodes / totalNodes : 0
    }
  }

  const getWorkflowRunningPromptIds = (workflowId: string | null) => {
    if (!workflowId) return []
    return Object.entries(promptStates.value)
      .filter(([promptId, state]) => {
        return (
          promptIdToWorkflowId.value.get(promptId) === workflowId &&
          isPromptRunning(state)
        )
      })
      .map(([promptId]) => promptId)
  }

  const getActivePromptForWorkflow = (workflowId: string | null) => {
    const runningPrompts = getWorkflowRunningPromptIds(workflowId)
    if (runningPrompts.length === 0) return null
    return getMostRecentPromptId(runningPrompts)
  }

  const runningPromptIds = computed<string[]>(() => {
    return Object.entries(promptStates.value)
      .filter(([_, state]) => isPromptRunning(state))
      .map(([promptId]) => promptId)
  })

  const runningWorkflowCount = computed<number>(
    () => runningPromptIds.value.length
  )

  const activePromptId = computed<string | null>(() => {
    if (runningPromptIds.value.length === 0) return null

    const activeWorkflowPrompt = getActivePromptForWorkflow(
      activeWorkflowId.value
    )
    if (activeWorkflowPrompt) return activeWorkflowPrompt

    if (
      lastStartedPromptId.value &&
      runningPromptIds.value.includes(lastStartedPromptId.value)
    ) {
      return lastStartedPromptId.value
    }

    return getMostRecentPromptId(runningPromptIds.value)
  })

  const activePrompt = computed<PromptExecutionState | undefined>(() =>
    getPromptState(activePromptId.value)
  )

  const nodeProgressStates = computed<Record<string, NodeProgressState>>(() =>
    getPromptNodeProgressStates(activePromptId.value)
  )

  const queuedPrompts = computed<Record<NodeId, QueuedPrompt>>(() => {
    const result: Record<NodeId, QueuedPrompt> = {}
    for (const [promptId, state] of Object.entries(promptStates.value)) {
      result[promptId] = {
        nodes: state.nodes,
        workflow: state.workflow
      }
    }
    return result
  })

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

    const workflow: ComfyWorkflow | undefined = activePrompt.value?.workflow
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
  const _executingNodeProgress = computed<ProgressWsMessage | null>(() => {
    return getPromptState(activePromptId.value)?.executingNodeProgress ?? null
  })
  const executingNodeProgress = computed(() =>
    _executingNodeProgress.value
      ? _executingNodeProgress.value.value / _executingNodeProgress.value.max
      : null
  )

  const totalNodesToExecute = computed<number>(() => {
    return getPromptProgress(activePromptId.value)?.totalNodes ?? 0
  })

  const isIdle = computed<boolean>(() => runningPromptIds.value.length === 0)

  const nodesExecuted = computed<number>(() => {
    return getPromptProgress(activePromptId.value)?.executedNodes ?? 0
  })

  const executionProgress = computed<number>(() => {
    return getPromptProgress(activePromptId.value)?.progress ?? 0
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
    const promptId = e.detail.prompt_id
    const promptState = ensurePromptState(promptId, e.detail.timestamp)
    promptState.isRunning = true
    promptState.executingNodeProgress = null
    touchPromptState(promptState, e.detail.timestamp)
    lastStartedPromptId.value = promptId
    clearInitializationByPromptId(promptId)
  }

  function handleExecutionCached(e: CustomEvent<ExecutionCachedWsMessage>) {
    const promptState = ensurePromptState(e.detail.prompt_id)
    for (const n of e.detail.nodes) {
      promptState.nodes[n] = true
    }
    touchPromptState(promptState)
  }

  function handleExecutionInterrupted(
    e: CustomEvent<ExecutionInterruptedWsMessage>
  ) {
    const pid = e.detail.prompt_id
    clearInitializationByPromptId(pid)
    resetExecutionState(pid)
  }

  function handleExecuted(e: CustomEvent<ExecutedWsMessage>) {
    const promptState = ensurePromptState(e.detail.prompt_id)
    promptState.nodes[e.detail.node] = true
    touchPromptState(promptState)
  }

  function handleExecutionSuccess(e: CustomEvent<ExecutionSuccessWsMessage>) {
    if (isCloud) {
      useTelemetry()?.trackExecutionSuccess({
        jobId: e.detail.prompt_id
      })
    }
    const pid = e.detail.prompt_id
    resetExecutionState(pid)
  }

  function handleExecuting(e: CustomEvent<ExecutingEventDetail>): void {
    const detail = e.detail
    const promptId =
      detail && typeof detail === 'object'
        ? detail.prompt_id
        : (activePromptId.value ?? lastStartedPromptId.value)
    if (!promptId) return

    const nodeId =
      detail && typeof detail === 'object'
        ? (detail.display_node ?? detail.node ?? null)
        : detail

    const promptState = ensurePromptState(String(promptId))
    promptState.executingNodeProgress = null
    const hasNode = nodeId !== null && nodeId !== undefined
    promptState.isRunning = promptState.isRunning || hasNode
    if (!hasNode) {
      promptState.isRunning = false
    }
    touchPromptState(promptState)
  }

  function handleProgressState(e: CustomEvent<ProgressStateWsMessage>) {
    const { nodes, prompt_id: pid } = e.detail
    const promptState = ensurePromptState(pid)

    // Revoke previews for nodes that are starting to execute
    const previousForPrompt = promptState.nodeProgressStates
    for (const nodeId in nodes) {
      const nodeState = nodes[nodeId]
      if (nodeState.state === 'running' && !previousForPrompt[nodeId]) {
        // This node just started executing, revoke its previews
        // Note that we're doing the *actual* node id instead of the display node id
        // here intentionally. That way, we don't clear the preview every time a new node
        // within an expanded graph starts executing.
        const { revokePreviewsByExecutionId } = useNodeOutputStore()
        revokePreviewsByExecutionId(nodeId)
      }
    }

    // Update the progress states for all nodes
    promptState.nodeProgressStates = nodes
    if (Object.values(nodes).some((node) => node.state === 'running')) {
      promptState.isRunning = true
    }
    touchPromptState(promptState)

    const runningNodeId = Object.entries(nodes).find(
      ([, nodeState]) => nodeState.state === 'running'
    )?.[0]
    if (runningNodeId) {
      const nodeState = nodes[runningNodeId]
      promptState.executingNodeProgress = {
        value: nodeState.value,
        max: nodeState.max,
        prompt_id: nodeState.prompt_id,
        node: nodeState.display_node_id || nodeState.node_id
      }
    }
  }

  function handleProgress(e: CustomEvent<ProgressWsMessage>) {
    const promptState = ensurePromptState(e.detail.prompt_id)
    promptState.executingNodeProgress = e.detail
    promptState.isRunning = true
    touchPromptState(promptState)
  }

  function handleStatus() {
    if (api.clientId) {
      clientId.value = api.clientId

      // Once we've received the clientId we no longer need to listen
      api.removeEventListener('status', handleStatus)
    }
  }

  function handleExecutionError(e: CustomEvent<ExecutionErrorWsMessage>) {
    lastExecutionError.value = e.detail
    if (isCloud) {
      useTelemetry()?.trackExecutionError({
        jobId: e.detail.prompt_id,
        nodeId: String(e.detail.node_id),
        nodeType: e.detail.node_type,
        error: e.detail.exception_message
      })
    }
    clearInitializationByPromptId(e.detail.prompt_id)
    resetExecutionState(e.detail.prompt_id)
  }

  /**
   * Notification handler used for frontend/cloud initialization tracking.
   * Marks a prompt as initializing when cloud notifies it is waiting for a machine.
   */
  function handleNotification(e: CustomEvent<NotificationWsMessage>) {
    const payload = e.detail
    const text = payload?.value || ''
    const id = payload?.id ? payload.id : ''
    if (!id) return
    // Until cloud implements a proper message
    if (text.includes('Waiting for a machine')) {
      const next = new Set(initializingPromptIds.value)
      next.add(id)
      initializingPromptIds.value = next
    }
  }

  function clearInitializationByPromptId(promptId: string | null) {
    if (!promptId) return
    if (!initializingPromptIds.value.has(promptId)) return
    const next = new Set(initializingPromptIds.value)
    next.delete(promptId)
    initializingPromptIds.value = next
  }

  function clearInitializationByPromptIds(promptIds: string[]) {
    if (!promptIds.length) return
    const current = initializingPromptIds.value
    const toRemove = promptIds.filter((id) => current.has(id))
    if (!toRemove.length) return
    const next = new Set(current)
    for (const id of toRemove) {
      next.delete(id)
    }
    initializingPromptIds.value = next
  }

  function isPromptInitializing(
    promptId: string | number | undefined
  ): boolean {
    if (!promptId) return false
    return initializingPromptIds.value.has(String(promptId))
  }

  /**
   * Reset execution-related state after a run completes or is stopped.
   */
  function resetExecutionState(pid?: string | null) {
    const promptId = pid ?? activePromptId.value ?? null
    if (!promptId) return
    const nextStates = { ...promptStates.value }
    delete nextStates[promptId]
    promptStates.value = nextStates
    if (lastStartedPromptId.value === promptId) {
      lastStartedPromptId.value = null
    }
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

  function storePrompt({
    nodes,
    id,
    workflow
  }: {
    nodes: string[]
    id: string
    workflow: ComfyWorkflow
  }) {
    const promptState = ensurePromptState(id)
    promptState.nodes = {
      ...nodes.reduce((p: Record<string, boolean>, n) => {
        p[n] = false
        return p
      }, {}),
      ...promptState.nodes
    }
    promptState.workflow = workflow
    touchPromptState(promptState)
    const wid = workflow?.activeState?.id ?? workflow?.initialState?.id
    if (wid) {
      promptIdToWorkflowId.value.set(String(id), String(wid))
    }
  }

  /**
   * Register or update a mapping from prompt_id to workflow ID.
   */
  function registerPromptWorkflowIdMapping(
    promptId: string,
    workflowId: string
  ) {
    if (!promptId || !workflowId) return
    promptIdToWorkflowId.value.set(String(promptId), String(workflowId))
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

  return {
    isIdle,
    clientId,
    activePromptId,
    promptStates,
    queuedPrompts,
    lastNodeErrors,
    lastExecutionError,
    lastExecutionErrorNodeId,
    executingNodeId,
    executingNodeIds,
    activePrompt,
    totalNodesToExecute,
    nodesExecuted,
    executionProgress,
    executingNode,
    executingNodeProgress,
    nodeProgressStates,
    nodeLocationProgressStates,
    nodeProgressStatesByPrompt,
    setNodeProgressStatesByPrompt,
    getPromptProgress,
    getPromptNodeProgressStates,
    getWorkflowRunningPromptIds,
    getActivePromptForWorkflow,
    runningPromptIds,
    runningWorkflowCount,
    initializingPromptIds,
    isPromptInitializing,
    clearInitializationByPromptId,
    clearInitializationByPromptIds,
    bindExecutionEvents,
    unbindExecutionEvents,
    storePrompt,
    registerPromptWorkflowIdMapping,
    uniqueExecutingNodeIdStrings,
    // Raw executing progress data for backward compatibility in ComfyApp.
    _executingNodeProgress,
    // NodeLocatorId conversion helpers
    executionIdToNodeLocatorId,
    nodeLocatorIdToExecutionId,
    promptIdToWorkflowId,
    // Node error lookup helpers
    getNodeErrors,
    slotHasError
  }
})
