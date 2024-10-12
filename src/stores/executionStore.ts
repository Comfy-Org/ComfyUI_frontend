// @ts-strict-ignore
import { ref, computed } from 'vue'
import { defineStore } from 'pinia'
import { api } from '../scripts/api'
import { ComfyWorkflow } from '@/scripts/workflows'
import type { ComfyNode, ComfyWorkflowJSON } from '@/types/comfyWorkflow'

export interface QueuedPrompt {
  nodes: Record<string, boolean>
  workflow?: ComfyWorkflow
}

interface NodeProgress {
  value: number
  max: number
}

export const useExecutionStore = defineStore('execution', () => {
  const activePromptId = ref<string | null>(null)
  const queuedPrompts = ref<Record<string, QueuedPrompt>>({})
  const executingNodeId = ref<string | null>(null)
  const executingNode = computed<ComfyNode | null>(() => {
    if (!executingNodeId.value) return null

    const workflow: ComfyWorkflow | null = activePrompt.value?.workflow
    if (!workflow) return null

    const canvasState: ComfyWorkflowJSON | null =
      workflow.changeTracker?.activeState
    if (!canvasState) return null

    return (
      canvasState.nodes.find((n) => String(n.id) === executingNodeId.value) ??
      null
    )
  })

  // This is the progress of the currently executing node, if any
  const _executingNodeProgress = ref<NodeProgress | null>(null)
  const executingNodeProgress = computed(() =>
    _executingNodeProgress.value
      ? Math.round(
          (_executingNodeProgress.value.value /
            _executingNodeProgress.value.max) *
            100
        )
      : null
  )

  const activePrompt = computed(() => queuedPrompts.value[activePromptId.value])

  const totalNodesToExecute = computed(() => {
    if (!activePrompt.value) return 0
    return Object.values(activePrompt.value.nodes).length
  })

  const isIdle = computed(() => !activePromptId.value)

  const nodesExecuted = computed(() => {
    if (!activePrompt.value) return 0
    return Object.values(activePrompt.value.nodes).filter(Boolean).length
  })

  const executionProgress = computed(() => {
    if (!activePrompt.value) return 0
    const total = totalNodesToExecute.value
    const done = nodesExecuted.value
    return Math.round((done / total) * 100)
  })

  function bindExecutionEvents() {
    api.addEventListener('execution_start', handleExecutionStart)
    api.addEventListener('execution_cached', handleExecutionCached)
    api.addEventListener('executed', handleExecuted)
    api.addEventListener('executing', handleExecuting)
    api.addEventListener('progress', handleProgress)
  }

  function unbindExecutionEvents() {
    api.removeEventListener('execution_start', handleExecutionStart)
    api.removeEventListener('execution_cached', handleExecutionCached)
    api.removeEventListener('executed', handleExecuted)
    api.removeEventListener('executing', handleExecuting)
    api.removeEventListener('progress', handleProgress)
  }

  function handleExecutionStart(e: CustomEvent) {
    activePromptId.value = e.detail.prompt_id
    queuedPrompts.value[activePromptId.value] ??= { nodes: {} }
  }

  function handleExecutionCached(e: CustomEvent) {
    if (!activePrompt.value) return
    for (const n of e.detail.nodes) {
      activePrompt.value.nodes[n] = true
    }
  }

  function handleExecuted(e: CustomEvent) {
    if (!activePrompt.value) return
    activePrompt.value.nodes[e.detail.node] = true
  }

  function handleExecuting(e: CustomEvent) {
    // Clear the current node progress when a new node starts executing
    _executingNodeProgress.value = null

    if (!activePrompt.value) return

    if (executingNodeId.value) {
      // Seems sometimes nodes that are cached fire executing but not executed
      activePrompt.value.nodes[executingNodeId.value] = true
    }
    executingNodeId.value = e.detail ? String(e.detail) : null
    if (!executingNodeId.value) {
      delete queuedPrompts.value[activePromptId.value]
      activePromptId.value = null
    }
  }

  function handleProgress(e: CustomEvent) {
    _executingNodeProgress.value = e.detail
  }

  function storePrompt({
    nodes,
    id,
    workflow
  }: {
    nodes: string[]
    id: string
    workflow: any
  }) {
    queuedPrompts.value[id] ??= { nodes: {} }
    const queuedPrompt = queuedPrompts.value[id]
    queuedPrompt.nodes = {
      ...nodes.reduce((p, n) => {
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
    storePrompt
  }
})
