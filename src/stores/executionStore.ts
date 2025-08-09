import { defineStore } from 'pinia'
import { computed, ref } from 'vue'

import type ChatHistoryWidget from '@/components/graph/widgets/ChatHistoryWidget.vue'
import { useNodeChatHistory } from '@/composables/node/useNodeChatHistory'
import { useNodeProgressText } from '@/composables/node/useNodeProgressText'
import type { LGraph, Subgraph } from '@/lib/litegraph/src/litegraph'
import type {
  DisplayComponentWsMessage,
  ExecutedWsMessage,
  ExecutionCachedWsMessage,
  ExecutionErrorWsMessage,
  ExecutionStartWsMessage,
  NodeError,
  NodeProgressState,
  ProgressStateWsMessage,
  ProgressTextWsMessage,
  ProgressWsMessage
} from '@/schemas/apiSchema'
import type {
  ComfyNode,
  ComfyWorkflowJSON,
  NodeId
} from '@/schemas/comfyWorkflowSchema'
import { api } from '@/scripts/api'
import { app } from '@/scripts/app'
import { useNodeOutputStore } from '@/stores/imagePreviewStore'
import type { NodeLocatorId } from '@/types/nodeIdentification'
import { createNodeLocatorId } from '@/types/nodeIdentification'

import { useCanvasStore } from './graphStore'
import { ComfyWorkflow, useWorkflowStore } from './workflowStore'

export interface QueuedPrompt {
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

export const useExecutionStore = defineStore('execution', () => {
  const workflowStore = useWorkflowStore()
  const canvasStore = useCanvasStore()

  const clientId = ref<string | null>(null)
  const activePromptId = ref<string | null>(null)
  const queuedPrompts = ref<Record<NodeId, QueuedPrompt>>({})
  const lastNodeErrors = ref<Record<NodeId, NodeError> | null>(null)
  const lastExecutionError = ref<ExecutionErrorWsMessage | null>(null)
  // This is the progress of all nodes in the currently executing workflow
  const nodeProgressStates = ref<Record<string, NodeProgressState>>({})

  /**
   * Convert execution context node IDs to NodeLocatorIds
   * @param nodeId The node ID from execution context (could be execution ID)
   * @returns The NodeLocatorId
   */
  const executionIdToNodeLocatorId = (
    nodeId: string | number
  ): NodeLocatorId => {
    const nodeIdStr = String(nodeId)

    if (!nodeIdStr.includes(':')) {
      // It's a top-level node ID
      return nodeIdStr
    }

    // It's an execution node ID
    const parts = nodeIdStr.split(':')
    const localNodeId = parts[parts.length - 1]
    const subgraphs = getSubgraphsFromInstanceIds(app.graph, parts)
    const nodeLocatorId = createNodeLocatorId(subgraphs.at(-1)!.id, localNodeId)
    return nodeLocatorId
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
    return Object.entries(nodeProgressStates)
      .filter(([_, state]) => state.state === 'running')
      .map(([nodeId, _]) => nodeId)
  })

  // @deprecated For backward compatibility - stores the primary executing node ID
  const executingNodeId = computed<NodeId | null>(() => {
    return executingNodeIds.value.length > 0 ? executingNodeIds.value[0] : null
  })

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
  const getSubgraphsFromInstanceIds = (
    currentGraph: LGraph | Subgraph,
    subgraphNodeIds: string[],
    subgraphs: Subgraph[] = []
  ): Subgraph[] => {
    // Last segment is the node portion; nothing to do.
    if (subgraphNodeIds.length === 1) return subgraphs

    const currentPart = subgraphNodeIds.shift()
    if (currentPart === undefined) return subgraphs

    const subgraph = subgraphNodeIdToSubgraph(currentPart, currentGraph)
    if (!subgraph) throw new Error(`Subgraph not found: ${currentPart}`)

    subgraphs.push(subgraph)
    return getSubgraphsFromInstanceIds(subgraph, subgraphNodeIds, subgraphs)
  }

  // This is the progress of the currently executing node (for backward compatibility)
  const _executingNodeProgress = ref<ProgressWsMessage | null>(null)
  const executingNodeProgress = computed(() =>
    _executingNodeProgress.value
      ? _executingNodeProgress.value.value / _executingNodeProgress.value.max
      : null
  )

  const activePrompt = computed<QueuedPrompt | undefined>(
    () => queuedPrompts.value[activePromptId.value ?? '']
  )

  const totalNodesToExecute = computed<number>(() => {
    if (!activePrompt.value) return 0
    return Object.values(activePrompt.value.nodes).length
  })

  const isIdle = computed<boolean>(() => !activePromptId.value)

  const nodesExecuted = computed<number>(() => {
    if (!activePrompt.value) return 0
    return Object.values(activePrompt.value.nodes).filter(Boolean).length
  })

  const executionProgress = computed<number>(() => {
    if (!activePrompt.value) return 0
    const total = totalNodesToExecute.value
    const done = nodesExecuted.value
    return total > 0 ? done / total : 0
  })

  function bindExecutionEvents() {
    api.addEventListener('execution_start', handleExecutionStart)
    api.addEventListener('execution_cached', handleExecutionCached)
    api.addEventListener('execution_interrupted', handleExecutionInterrupted)
    api.addEventListener('executed', handleExecuted)
    api.addEventListener('executing', handleExecuting)
    api.addEventListener('progress', handleProgress)
    api.addEventListener('progress_state', handleProgressState)
    api.addEventListener('status', handleStatus)
    api.addEventListener('execution_error', handleExecutionError)
    api.addEventListener('progress_text', handleProgressText)
    api.addEventListener('display_component', handleDisplayComponent)
  }

  function unbindExecutionEvents() {
    api.removeEventListener('execution_start', handleExecutionStart)
    api.removeEventListener('execution_cached', handleExecutionCached)
    api.removeEventListener('execution_interrupted', handleExecutionInterrupted)
    api.removeEventListener('executed', handleExecuted)
    api.removeEventListener('executing', handleExecuting)
    api.removeEventListener('progress', handleProgress)
    api.removeEventListener('progress_state', handleProgressState)
    api.removeEventListener('status', handleStatus)
    api.removeEventListener('execution_error', handleExecutionError)
    api.removeEventListener('progress_text', handleProgressText)
    api.removeEventListener('display_component', handleDisplayComponent)
  }

  function handleExecutionStart(e: CustomEvent<ExecutionStartWsMessage>) {
    lastExecutionError.value = null
    activePromptId.value = e.detail.prompt_id
    queuedPrompts.value[activePromptId.value] ??= { nodes: {} }
  }

  function handleExecutionCached(e: CustomEvent<ExecutionCachedWsMessage>) {
    if (!activePrompt.value) return
    for (const n of e.detail.nodes) {
      activePrompt.value.nodes[n] = true
    }
  }

  function handleExecutionInterrupted() {
    nodeProgressStates.value = {}
  }

  function handleExecuted(e: CustomEvent<ExecutedWsMessage>) {
    if (!activePrompt.value) return
    activePrompt.value.nodes[e.detail.node] = true
  }

  function handleExecuting(e: CustomEvent<NodeId | null>): void {
    // Clear the current node progress when a new node starts executing
    _executingNodeProgress.value = null

    if (!activePrompt.value) return

    // Update the executing nodes list
    if (typeof e.detail !== 'string') {
      if (activePromptId.value) {
        delete queuedPrompts.value[activePromptId.value]
      }
      activePromptId.value = null
    }
  }

  function handleProgressState(e: CustomEvent<ProgressStateWsMessage>) {
    const { nodes } = e.detail

    // Revoke previews for nodes that are starting to execute
    for (const nodeId in nodes) {
      const nodeState = nodes[nodeId]
      if (nodeState.state === 'running' && !nodeProgressStates.value[nodeId]) {
        // This node just started executing, revoke its previews
        // Note that we're doing the *actual* node id instead of the display node id
        // here intentionally. That way, we don't clear the preview every time a new node
        // within an expanded graph starts executing.
        const { revokePreviewsByExecutionId } = useNodeOutputStore()
        revokePreviewsByExecutionId(nodeId)
      }
    }

    // Update the progress states for all nodes
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
    lastExecutionError.value = e.detail
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

  function handleDisplayComponent(e: CustomEvent<DisplayComponentWsMessage>) {
    const { node_id: nodeId, component, props = {} } = e.detail

    // Handle execution node IDs for subgraphs
    const currentId = getNodeIdIfExecuting(nodeId)
    const node = canvasStore.getCanvas().graph?.getNodeById(currentId)
    if (!node) return

    if (component === 'ChatHistoryWidget') {
      useNodeChatHistory({
        props: props as Omit<
          InstanceType<typeof ChatHistoryWidget>['$props'],
          'widget'
        >
      }).showChatHistory(node)
    }
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
    queuedPrompts.value[id] ??= { nodes: {} }
    const queuedPrompt = queuedPrompts.value[id]
    queuedPrompt.nodes = {
      ...nodes.reduce((p: Record<string, boolean>, n) => {
        p[n] = false
        return p
      }, {}),
      ...queuedPrompt.nodes
    }
    queuedPrompt.workflow = workflow

    console.debug(
      `queued task ${id} with ${Object.values(queuedPrompt.nodes).length} nodes`
    )
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

  return {
    isIdle,
    clientId,
    /**
     * The id of the prompt that is currently being executed
     */
    activePromptId,
    /**
     * The queued prompts
     */
    queuedPrompts,
    /**
     * The node errors from the previous execution.
     */
    lastNodeErrors,
    /**
     * The error from the previous execution.
     */
    lastExecutionError,
    /**
     * The id of the node that is currently being executed (backward compatibility)
     */
    executingNodeId,
    /**
     * The list of all nodes that are currently executing
     */
    executingNodeIds,
    /**
     * The prompt that is currently being executed
     */
    activePrompt,
    /**
     * The total number of nodes to execute
     */
    totalNodesToExecute,
    /**
     * The number of nodes that have been executed
     */
    nodesExecuted,
    /**
     * The progress of the execution
     */
    executionProgress,
    /**
     * The node that is currently being executed (backward compatibility)
     */
    executingNode,
    /**
     * The progress of the executing node (backward compatibility)
     */
    executingNodeProgress,
    /**
     * All node progress states from progress_state events
     */
    nodeProgressStates,
    nodeLocationProgressStates,
    bindExecutionEvents,
    unbindExecutionEvents,
    storePrompt,
    // Raw executing progress data for backward compatibility in ComfyApp.
    _executingNodeProgress,
    // NodeLocatorId conversion helpers
    executionIdToNodeLocatorId,
    nodeLocatorIdToExecutionId
  }
})
