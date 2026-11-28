import { onBeforeUnmount, onMounted, watch } from 'vue'

import type { LGraph } from '@/lib/litegraph/src/litegraph'
import { registerMinimapDecorationLayer } from '@/platform/canvas/minimapDecorationRegistry'
import type { MinimapDecorationLayer } from '@/platform/canvas/minimapDecorationRegistry'
import { useSettingStore } from '@/platform/settings/settingStore'
import { reportError } from '@comfyorg/telemetry/reportError'
import {
  toOwningGraphId,
  toRootGraphId
} from '@comfyorg/graph-model/graphScopeId'
import { parseNodeId } from '@comfyorg/graph-model/nodeId'

import { useAgentGraphActivityStore } from '@/workbench/extensions/agent/stores/agent/agentGraphActivityStore'

interface AgentGraphActivityPresentationOptions {
  graph: () => LGraph | null | undefined
}

export function useAgentGraphActivityPresentation({
  graph
}: AgentGraphActivityPresentationOptions): void {
  const activity = useAgentGraphActivityStore()
  const settings = useSettingStore()
  let minimapLayer: MinimapDecorationLayer | undefined

  watch(
    graph,
    (currentGraph, _previous, onCleanup) => {
      if (!currentGraph?.events) return
      const events = currentGraph.events as EventTarget
      const onNodeRemoved: EventListener = (event) => {
        if (!(event instanceof CustomEvent)) return
        const state = activity.state
        if (
          state.phase === 'idle' ||
          currentGraph.rootGraph.id !== state.rootGraphId
        )
          return
        const rawNodeId = event.detail?.node?.id
        if (rawNodeId === null || rawNodeId === undefined) return
        const nodeId = parseNodeId(String(rawNodeId))
        if (nodeId !== null) activity.removeNodes([nodeId])
      }
      events.addEventListener('node:removed', onNodeRemoved)
      onCleanup(() => events.removeEventListener('node:removed', onNodeRemoved))
    },
    { immediate: true }
  )

  function syncMinimapLayer(): void {
    const state = activity.state
    if (state.phase === 'idle') {
      minimapLayer?.replace([])
      return
    }
    const rootGraphId = toRootGraphId(state.rootGraphId)
    minimapLayer?.replace(
      state.nodeIds.map((nodeId) => ({
        target: {
          rootGraphId,
          owningGraphId: toOwningGraphId(state.rootGraphId),
          nodeId
        },
        enter: 'pop'
      }))
    )
    if (state.phase === 'running' && !settings.get('Comfy.Minimap.Visible')) {
      void settings.set('Comfy.Minimap.Visible', true).catch((error) =>
        reportError(error, {
          surface: 'agent',
          errorType: 'failure_showing_minimap_for_agent_graph_activity',
          level: 'warning'
        })
      )
    }
  }

  watch(() => activity.state, syncMinimapLayer, { immediate: true })

  onMounted(() => {
    minimapLayer = registerMinimapDecorationLayer('agent.graph-activity')
    syncMinimapLayer()
  })

  onBeforeUnmount(() => {
    try {
      minimapLayer?.dispose()
    } catch (error) {
      try {
        reportError(error, {
          surface: 'agent',
          errorType: 'failure_tearing_down_agent_panel',
          tags: { step: 'disposeMinimapLayer' }
        })
      } catch {
        return
      }
    }
  })
}
