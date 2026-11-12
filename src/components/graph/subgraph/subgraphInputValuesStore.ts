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

    const selected = computed(() => {
      const current = graph.value
      if (!current) return undefined
      const root = current.rootGraph
      const instancesIn = (graphId: UUID) =>
        nodeDataStore
          .getGraphNodesFor(root.id, graphId)
          .filter((node) => node.type === current.id)
      const entered = enteredHosts.value.get(current.id)
      if (entered)
        return instancesIn(entered.graphId).find(
          (node) => node.id === entered.nodeId
        )
      const instances = [root.id, ...root.subgraphs.keys()].flatMap(instancesIn)
      return instances.length === 1 ? instances[0] : undefined
    })
    return { graph, selected }
  }
)
