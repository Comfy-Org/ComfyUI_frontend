import { defineStore } from 'pinia'
import { onScopeDispose, ref, watch } from 'vue'

import { registerMinimapDecorationLayer } from '@/platform/canvas/minimapDecorationRegistry'
import { useSettingStore } from '@/platform/settings/settingStore'
import { reportError } from '@/platform/telemetry/reportError'
// oxlint-disable-next-line comfy/no-restricted-paths -- the store owns the lifetime of graph-activity decorations, including pruning removed nodes while the panel is closed.
import { useCanvasStore } from '@/renderer/core/canvas/canvasStore'
import type { RootGraphId } from '@/types/graphScopeId'
import { toOwningGraphId, toRootGraphId } from '@/types/graphScopeId'
import { parseNodeId } from '@/types/nodeId'
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
    const settingStore = useSettingStore()
    const canvasStore = useCanvasStore()
    const minimapLayer = registerMinimapDecorationLayer('agent.graph-activity')

    watch(
      state,
      (activity) => {
        if (activity.phase === 'idle') {
          minimapLayer.replace([])
          return
        }
        const rootGraphId = toRootGraphId(activity.rootGraphId)
        minimapLayer.replace(
          activity.nodeIds.map((nodeId) => ({
            target: {
              rootGraphId,
              owningGraphId: toOwningGraphId(activity.rootGraphId),
              nodeId
            },
            enter: 'pop'
          }))
        )
        if (
          activity.phase === 'running' &&
          !settingStore.get('Comfy.Minimap.Visible')
        )
          void settingStore
            .set('Comfy.Minimap.Visible', true)
            .catch((error: unknown) =>
              reportError(error, {
                surface: 'graph',
                errorType: 'minimap_visibility_setting_failed'
              })
            )
      },
      { immediate: true }
    )
    watch(
      () => canvasStore.canvas?.graph,
      (graph, _previous, onCleanup) => {
        if (!graph?.events) return
        const events = graph.events as EventTarget
        const onNodeRemoved: EventListener = (event) => {
          if (!(event instanceof CustomEvent)) return
          const nodeId = parseNodeId(String(event.detail.node?.id))
          if (nodeId) removeNodes([nodeId])
        }
        events.addEventListener('node:removed', onNodeRemoved)
        onCleanup(() =>
          events.removeEventListener('node:removed', onNodeRemoved)
        )
      },
      { immediate: true }
    )
    onScopeDispose(() => {
      if (settleTimer !== undefined) clearTimeout(settleTimer)
      settleTimer = undefined
      minimapLayer.dispose()
    })

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
