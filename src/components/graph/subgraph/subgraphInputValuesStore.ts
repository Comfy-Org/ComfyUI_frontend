import { useEventListener } from '@vueuse/core'
import { defineStore } from 'pinia'
import { computed, shallowRef, watch } from 'vue'

import type { NodeId } from '@comfyorg/graph-model/nodeId'
import type { LGraphCanvasEventMap } from '@/lib/litegraph/src/infrastructure/LGraphCanvasEventMap'
import { useCanvasStore } from '@/renderer/core/canvas/canvasStore'
import { useNodeDataStore } from '@/stores/nodeDataStore'
import { isSubgraph } from '@/utils/typeGuardUtil'
import type { UUID } from '@/utils/uuid'

interface EnteredHost {
  readonly graphId: UUID
  readonly nodeId: NodeId
}

export const useSubgraphInputValuesStore = defineStore(
  'subgraphInputValues',
  () => {
    const canvasStore = useCanvasStore()
    const nodeDataStore = useNodeDataStore()
    const enteredHosts = shallowRef<ReadonlyMap<UUID, EnteredHost>>(new Map())
    const graph = computed(() => {
      const current = canvasStore.currentGraph
      return isSubgraph(current) ? current : undefined
    })

    watch(
      () => canvasStore.currentGraph,
      (current, previous) => {
        if (
          !isSubgraph(current) ||
          current.rootGraph.id !== previous?.rootGraph.id
        )
          enteredHosts.value = new Map()
      },
      { flush: 'sync' }
    )

    useEventListener(
      () => canvasStore.canvas?.canvas,
      'subgraph-opened',
      (event: CustomEvent<LGraphCanvasEventMap['subgraph-opened']>) => {
        const { fromNode, subgraph, closingGraph } = event.detail
        enteredHosts.value = new Map(enteredHosts.value).set(subgraph.id, {
          graphId: closingGraph.id,
          nodeId: fromNode.id
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
      const host = current && enteredHosts.value.get(current.id)
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
