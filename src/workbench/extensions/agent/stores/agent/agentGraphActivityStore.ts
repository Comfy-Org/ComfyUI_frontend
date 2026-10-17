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
      nodeIds: readonly NodeId[],
      turnId?: TurnId | null
    ): void {
      if (nodeIds.length === 0) return
      // PM-1874: a materialization can arrive after its own turn finished --
      // the CRDT follower only reports a node once it resolves in the live
      // graph, which can lag the turn's own startTurn/finishTurn boundary by
      // one or more frames. Without this guard, a stale node from turn A
      // lands here while turn B is already `running` for the same
      // workflow/rootGraphId and gets folded into B's count (the observed
      // "60 nodes added" when only 3 were added this turn). The caller must
      // pass the turnId it captured when the underlying CRDT event fired, so
      // this can tell "my turn is still open" from "a different turn opened
      // after mine finished". Omitting turnId (undefined) opts out of the
      // guard for callers that have no turn concept yet.
      const isStaleTurn =
        turnId !== undefined &&
        (!turnOpen.value || turnId !== currentTurnId.value)
      if (isStaleTurn) return
      turnOpen.value = true
      if (settleTimer !== undefined) clearTimeout(settleTimer)
      settleTimer = undefined
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
