import { ref, computed } from 'vue'
import { defineStore } from 'pinia'
import { api } from '../scripts/api'

export interface QueuedPrompt {
  nodes: Record<string, boolean>
  workflow?: any // TODO: Replace 'any' with the actual type of workflow
}

export const useExecutionStore = defineStore('execution', () => {
  const activePromptId = ref<string | null>(null)
  const queuedPrompts = ref<Record<string, QueuedPrompt>>({})
  const executing = ref<string | null>(null)

  const activePrompt = computed(() => queuedPrompts.value[activePromptId.value])

  const totalNodesToExecute = computed(() => {
    if (!activePrompt.value) return 0
    return Object.values(activePrompt.value.nodes).length
  })

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
  }

  function unbindExecutionEvents() {
    api.removeEventListener('execution_start', handleExecutionStart)
    api.removeEventListener('execution_cached', handleExecutionCached)
    api.removeEventListener('executed', handleExecuted)
    api.removeEventListener('executing', handleExecuting)
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
    if (!activePrompt.value) return

    if (executing.value) {
      // Seems sometimes nodes that are cached fire executing but not executed
      activePrompt.value.nodes[executing.value] = true
    }
    executing.value = e.detail
    if (!executing.value) {
      delete queuedPrompts.value[activePromptId.value]
      activePromptId.value = null
    }
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
    activePromptId,
    queuedPrompts,
    executing,
    activePrompt,
    totalNodesToExecute,
    nodesExecuted,
    executionProgress,
    bindExecutionEvents,
    unbindExecutionEvents,
    storePrompt
  }
})
