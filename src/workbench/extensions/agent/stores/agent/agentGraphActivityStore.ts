import { defineStore } from 'pinia'
import { ref } from 'vue'

import type { NodeId } from '@/types/nodeId'

const SETTLE_MS = 1_000

interface AgentGraphTarget {
  workflowId: string
  rootGraphId: string
}

interface ActivityPayload extends AgentGraphTarget {
  nodeIds: readonly NodeId[]
}

type ActivityState =
  | { phase: 'idle' }
  | ({ phase: 'running' | 'settling' } & ActivityPayload)
  | ({ phase: 'complete' } & ActivityPayload)

export const useAgentGraphActivityStore = defineStore(
  'agentGraphActivity',
  () => {
    const state = ref<ActivityState>({ phase: 'idle' })
    const turnOpen = ref(false)
    let settleTimer: ReturnType<typeof setTimeout> | undefined

    function startTurn(): void {
      if (turnOpen.value) return
      turnOpen.value = true
      if (settleTimer !== undefined) clearTimeout(settleTimer)
      settleTimer = undefined
      if (state.value.phase === 'settling') {
        state.value = { ...state.value, phase: 'running' }
        return
      }
      state.value = { phase: 'idle' }
    }

    function recordMaterialized(
      target: AgentGraphTarget,
      nodeIds: readonly NodeId[]
    ): void {
      if (nodeIds.length === 0) return
      if (settleTimer !== undefined) clearTimeout(settleTimer)
      settleTimer = undefined
      turnOpen.value = true
      const current = state.value
      const sameTarget =
        current.phase !== 'idle' &&
        current.workflowId === target.workflowId &&
        current.rootGraphId === target.rootGraphId
      const previous = sameTarget ? current.nodeIds : []
      state.value = {
        phase: 'running',
        ...target,
        nodeIds: [...new Set([...previous, ...nodeIds])]
      }
    }

    function finishTurn(): void {
      turnOpen.value = false
      if (state.value.phase !== 'running') return
      if (settleTimer !== undefined) clearTimeout(settleTimer)
      state.value = { ...state.value, phase: 'settling' }
      settleTimer = setTimeout(() => {
        settleTimer = undefined
        if (state.value.phase !== 'settling') return
        state.value = { ...state.value, phase: 'complete' }
      }, SETTLE_MS)
    }

    function dismiss(): void {
      if (settleTimer !== undefined) clearTimeout(settleTimer)
      settleTimer = undefined
      state.value = { phase: 'idle' }
    }

    function resetWorkflow(workflowId: string): void {
      if (state.value.phase !== 'idle' && state.value.workflowId === workflowId)
        dismiss()
    }

    return {
      state,
      startTurn,
      recordMaterialized,
      finishTurn,
      dismiss,
      resetWorkflow
    }
  }
)
