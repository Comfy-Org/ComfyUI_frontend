import { defineStore } from 'pinia'
import { computed, ref } from 'vue'

import type {
  ExecutedWsMessage,
  ExecutingWsMessage,
  ExecutionCachedWsMessage,
  ExecutionStartWsMessage,
  ProgressWsMessage
} from '@/schemas/apiSchema'
import type {
  ComfyNode,
  ComfyWorkflowJSON
} from '@/schemas/comfyWorkflowSchema'
import { api } from '@/scripts/api'

import { ComfyWorkflow } from './workflowStore'

export interface QueuedPrompt {
  nodes: Record<string, boolean>
  workflow?: ComfyWorkflow
}

export const useExecutionStore = defineStore('execution', () => {
  const clientId = ref<string | null>(null)
  const activePromptId = ref<string | null>(null)
  const queuedPrompts = ref<Record<string, QueuedPrompt>>({})
  const executingNodeId = ref<string | null>(null)
  const executingNode = computed<ComfyNode | null>(() => {
    if (!executingNodeId.value) return null

    const workflow: ComfyWorkflow | undefined = activePrompt.value?.workflow
    if (!workflow) return null

    const canvasState: ComfyWorkflowJSON | null =
      workflow.changeTracker?.activeState ?? null
    if (!canvasState) return null

    return (
      canvasState.nodes.find(
        (n: ComfyNode) => String(n.id) === executingNodeId.value
      ) ?? null
    )
  })

  // This is the progress of the currently executing node, if any
  const _executingNodeProgress = ref<ProgressWsMessage | null>(null)
  const executingNodeProgress = computed(() =>
    _executingNodeProgress.value
      ? Math.round(
          (_executingNodeProgress.value.value /
            _executingNodeProgress.value.max) *
            100
        )
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
    return Math.round((done / total) * 100)
  })

  function bindExecutionEvents() {
    api.addEventListener(
      'execution_start',
      handleExecutionStart as EventListener
    )
    api.addEventListener(
      'execution_cached',
      handleExecutionCached as EventListener
    )
    api.addEventListener('executed', handleExecuted as EventListener)
    api.addEventListener('executing', handleExecuting as EventListener)
    api.addEventListener('progress', handleProgress as EventListener)
    api.addEventListener('status', handleStatus as EventListener)
  }

  function unbindExecutionEvents() {
    api.removeEventListener(
      'execution_start',
      handleExecutionStart as EventListener
    )
    api.removeEventListener(
      'execution_cached',
      handleExecutionCached as EventListener
    )
    api.removeEventListener('executed', handleExecuted as EventListener)
    api.removeEventListener('executing', handleExecuting as EventListener)
    api.removeEventListener('progress', handleProgress as EventListener)
    api.removeEventListener('status', handleStatus as EventListener)
  }

  function handleExecutionStart(e: CustomEvent<ExecutionStartWsMessage>) {
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

  function handleExecuting(e: CustomEvent<ExecutingWsMessage>) {
    // Clear the current node progress when a new node starts executing
    _executingNodeProgress.value = null

    if (!activePrompt.value) return

    if (executingNodeId.value && activePrompt.value) {
      // Seems sometimes nodes that are cached fire executing but not executed
      activePrompt.value.nodes[executingNodeId.value] = true
    }
    executingNodeId.value = e.detail ? String(e.detail) : null
    if (!executingNodeId.value) {
      if (activePromptId.value) {
        delete queuedPrompts.value[activePromptId.value]
      }
      activePromptId.value = null
    }
  }

  function handleProgress(e: CustomEvent<ProgressWsMessage>) {
    _executingNodeProgress.value = e.detail
  }

  function handleStatus() {
    if (api.clientId) {
      clientId.value = api.clientId

      // Once we've received the clientId we no longer need to listen
      api.removeEventListener('status', handleStatus as EventListener)
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
    activePromptId,
    queuedPrompts,
    executingNodeId,
    activePrompt,
    totalNodesToExecute,
    nodesExecuted,
    executionProgress,
    executingNode,
    executingNodeProgress,
    bindExecutionEvents,
    unbindExecutionEvents,
    storePrompt,
    // Raw executing progress data for backward compatibility in ComfyApp.
    _executingNodeProgress
  }
})
