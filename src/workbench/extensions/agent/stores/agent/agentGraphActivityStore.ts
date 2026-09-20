import { defineStore } from 'pinia'
import { ref } from 'vue'

import type { RootGraphId } from '@/types/graphScopeId'
import type { NodeId } from '@/types/nodeId'

import type { TurnId } from '../../schemas/agentApiSchema'

const SETTLE_MS = 1_000

interface AgentGraphTarget {
  workflowId: string
  rootGraphId: RootGraphId
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
    const currentTurnId = ref<TurnId | null>(null)
    let settleTimer: ReturnType<typeof setTimeout> | undefined

    function startTurn(turnId: TurnId | null = null): void {
      if (turnOpen.value && currentTurnId.value === turnId) return
      const previous = state.value
      const resumesCurrentTurn =
        currentTurnId.value === turnId &&
        (previous.phase === 'settling' || previous.phase === 'complete')
      turnOpen.value = true
      currentTurnId.value = turnId
      if (settleTimer !== undefined) clearTimeout(settleTimer)
      settleTimer = undefined
      if (resumesCurrentTurn) {
        state.value = { ...previous, phase: 'running' }
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

    function removeNodes(nodeIds: readonly NodeId[]): void {
      if (state.value.phase === 'idle' || nodeIds.length === 0) return
      const removed = new Set(nodeIds)
      const remaining = state.value.nodeIds.filter((id) => !removed.has(id))
      state.value =
        remaining.length === 0
          ? { phase: 'idle' }
          : { ...state.value, nodeIds: remaining }
    }

    function dismiss(): void {
      if (settleTimer !== undefined) clearTimeout(settleTimer)
      settleTimer = undefined
      currentTurnId.value = null
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
      removeNodes,
      dismiss,
      resetWorkflow
    }
  }
)
