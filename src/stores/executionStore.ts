import type { LGraph, Subgraph } from '@comfyorg/litegraph'
import { defineStore } from 'pinia'
import { computed, ref } from 'vue'

import type ChatHistoryWidget from '@/components/graph/widgets/ChatHistoryWidget.vue'
import { useNodeChatHistory } from '@/composables/node/useNodeChatHistory'
import { useNodeProgressText } from '@/composables/node/useNodeProgressText'
import type {
  DisplayComponentWsMessage,
  ExecutedWsMessage,
  ExecutionCachedWsMessage,
  ExecutionErrorWsMessage,
  ExecutionStartWsMessage,
  NodeError,
  ProgressTextWsMessage,
  ProgressWsMessage
} from '@/schemas/apiSchema'
import type {
  ComfyNode,
  ComfyWorkflowJSON,
  NodeId
} from '@/schemas/comfyWorkflowSchema'
import { api } from '@/scripts/api'

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
  const executingNodeId = ref<NodeId | null>(null)
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

  const executionIdToCurrentId = (id: string) => {
    const subgraph = workflowStore.activeSubgraph

    // Short-circuit: ID belongs to the parent workflow / no active subgraph
    if (!id.includes(':')) {
      return !subgraph ? id : undefined
    } else if (!subgraph) {
      return
    }

    // Parse the hierarchical ID (e.g., "123:456:789")
    const subgraphNodeIds = id.split(':')

    // If the last subgraph is the active subgraph, return the node ID
    const subgraphs = getSubgraphsFromInstanceIds(
      subgraph.rootGraph,
      subgraphNodeIds
    )
    if (subgraphs.at(-1) === subgraph) {
      return subgraphNodeIds.at(-1)
    }
  }

  // This is the progress of the currently executing node, if any
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
    api.addEventListener('executed', handleExecuted)
    api.addEventListener('executing', handleExecuting)
    api.addEventListener('progress', handleProgress)
    api.addEventListener('status', handleStatus)
    api.addEventListener('execution_error', handleExecutionError)
  }
  api.addEventListener('progress_text', handleProgressText)
  api.addEventListener('display_component', handleDisplayComponent)

  function unbindExecutionEvents() {
    api.removeEventListener('execution_start', handleExecutionStart)
    api.removeEventListener('execution_cached', handleExecutionCached)
    api.removeEventListener('executed', handleExecuted)
    api.removeEventListener('executing', handleExecuting)
    api.removeEventListener('progress', handleProgress)
    api.removeEventListener('status', handleStatus)
    api.removeEventListener('execution_error', handleExecutionError)
    api.removeEventListener('progress_text', handleProgressText)
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

  function handleExecuted(e: CustomEvent<ExecutedWsMessage>) {
    if (!activePrompt.value) return
    activePrompt.value.nodes[e.detail.node] = true
  }

  function handleExecuting(e: CustomEvent<NodeId | null>): void {
    // Clear the current node progress when a new node starts executing
    _executingNodeProgress.value = null

    if (!activePrompt.value) return

    if (executingNodeId.value && activePrompt.value) {
      // Seems sometimes nodes that are cached fire executing but not executed
      activePrompt.value.nodes[executingNodeId.value] = true
    }
    if (typeof e.detail === 'string') {
      executingNodeId.value = executionIdToCurrentId(e.detail) ?? null
    } else {
      executingNodeId.value = e.detail
      if (executingNodeId.value === null) {
        if (activePromptId.value) {
          delete queuedPrompts.value[activePromptId.value]
        }
        activePromptId.value = null
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

    // Handle hierarchical node IDs for subgraphs
    const currentId = getNodeIdIfExecuting(nodeId)
    const node = canvasStore.getCanvas().graph?.getNodeById(currentId)
    if (!node) return

    useNodeProgressText().showTextPreview(node, text)
  }

  function handleDisplayComponent(e: CustomEvent<DisplayComponentWsMessage>) {
    const { node_id: nodeId, component, props = {} } = e.detail

    // Handle hierarchical node IDs for subgraphs
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
     * The id of the node that is currently being executed
     */
    executingNodeId,
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
     * The node that is currently being executed
     */
    executingNode,
    /**
     * The progress of the executing node (if the node reports progress)
     */
    executingNodeProgress,
    bindExecutionEvents,
    unbindExecutionEvents,
    storePrompt,
    // Raw executing progress data for backward compatibility in ComfyApp.
    _executingNodeProgress
  }
})
