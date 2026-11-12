import { useEventListener } from '@vueuse/core'
import { defineStore } from 'pinia'
import { computed, shallowRef, watch } from 'vue'

import {
  emptySubgraphHostContext,
  transitionSubgraphHostContext
} from '@/core/graph/subgraph/subgraphHostContext'
import type { LGraphCanvasEventMap } from '@/lib/litegraph/src/infrastructure/LGraphCanvasEventMap'
import { useCanvasStore } from '@/renderer/core/canvas/canvasStore'
import { useNodeDataStore } from '@/stores/nodeDataStore'
import { isSubgraph } from '@/utils/typeGuardUtil'

export const useSubgraphInputValuesStore = defineStore(
  'subgraphInputValues',
  () => {
    const canvasStore = useCanvasStore()
    const nodeDataStore = useNodeDataStore()
    const context = shallowRef(emptySubgraphHostContext)
    const graph = computed(() => {
      const current = canvasStore.currentGraph
      return isSubgraph(current) ? current : undefined
    })

    watch(
      () => canvasStore.currentGraph,
      (current, previous) => {
        if (current?.rootGraph !== previous?.rootGraph) {
          context.value = emptySubgraphHostContext
        }
        if (!current) return
        context.value = transitionSubgraphHostContext(context.value, {
          type: 'navigated',
          rootGraphId: current.rootGraph.id,
          graphId: current.id
        })
      },
      { immediate: true, flush: 'sync' }
    )

    useEventListener(
      () => canvasStore.canvas?.canvas,
      'subgraph-opened',
      (event: CustomEvent<LGraphCanvasEventMap['subgraph-opened']>) => {
        const { fromNode, subgraph, closingGraph } = event.detail
        context.value = transitionSubgraphHostContext(context.value, {
          type: 'entered',
          rootGraphId: subgraph.rootGraph.id,
          host: {
            graphId: closingGraph.id,
            nodeId: fromNode.id,
            subgraphId: subgraph.id
          }
        })
      }
    )

    const candidates = computed(() => {
      const current = graph.value
      if (!current) return []
      const root = current.rootGraph
      return [root.id, ...root.subgraphs.keys()].flatMap((graphId) =>
        nodeDataStore
          .getGraphNodesFor(root.id, graphId)
          .filter((node) => node.type === current.id)
      )
    })
    const selected = computed(() => {
      const current = graph.value
      const host = context.value.hosts.find(
        (entry) => entry.subgraphId === current?.id
      )
      return host
        ? candidates.value.find(
            (node) => node.graphId === host.graphId && node.id === host.nodeId
          )
        : candidates.value.length === 1
          ? candidates.value[0]
          : undefined
    })
    return { graph, selected }
  }
)
