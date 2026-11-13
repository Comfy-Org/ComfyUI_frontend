import { useEventListener } from '@vueuse/core'
import { defineStore } from 'pinia'
import { computed, shallowRef, watch } from 'vue'

import { graphScopeOf } from '@comfyorg/graph-model/graphScopeId'
import type { NodeState } from '@comfyorg/graph-model/nodeState'
import { resolveInputValueSource } from '@/core/graph/subgraph/resolveInputValueSource'
import type {
  InputValueSource,
  ValueSourceGraph
} from '@/core/graph/subgraph/resolveInputValueSource'
import type { LGraphCanvasEventMap } from '@/lib/litegraph/src/infrastructure/LGraphCanvasEventMap'
import { useCanvasStore } from '@/renderer/core/canvas/canvasStore'
import { useLinkStore } from '@/stores/linkStore'
import { useNodeDataStore } from '@/stores/nodeDataStore'
import { useWidgetValueStore } from '@/stores/widgetValueStore'
import { isSubgraph } from '@/utils/typeGuardUtil'
import type { UUID } from '@/utils/uuid'

export const useSubgraphInputValuesStore = defineStore(
  'subgraphInputValues',
  () => {
    const canvasStore = useCanvasStore()
    const nodeDataStore = useNodeDataStore()
    const linkStore = useLinkStore()
    const widgetStore = useWidgetValueStore()
    const enteredHosts = shallowRef<
      ReadonlyMap<UUID, Pick<NodeState, 'graphId' | 'id'>>
    >(new Map())
    const graph = computed(() => {
      const current = canvasStore.currentGraph
      return isSubgraph(current) ? current : undefined
    })

    watch(
      () => graph.value?.rootGraph.id,
      () => (enteredHosts.value = new Map()),
      { flush: 'sync' }
    )

    useEventListener(
      () => canvasStore.canvas?.canvas,
      'subgraph-opened',
      (event: CustomEvent<LGraphCanvasEventMap['subgraph-opened']>) => {
        const { fromNode, subgraph, closingGraph } = event.detail
        enteredHosts.value = new Map(enteredHosts.value).set(subgraph.id, {
          graphId: closingGraph.id,
          id: fromNode.id
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
          (node) => node.id === entered.id
        )
      const instances = [root.id, ...root.subgraphs.keys()].flatMap(instancesIn)
      return instances.length === 1 ? instances[0] : undefined
    })

    const sources = computed(() => {
      const current = graph.value
      const host = selected.value
      const result = new Map<string, InputValueSource>()
      if (!current || !host) return result
      const root = current.rootGraph
      const scope = graphScopeOf({ id: host.graphId, rootGraph: root })
      const sourceGraph: ValueSourceGraph = {
        nodes: new Map(
          nodeDataStore
            .getGraphNodesFor(root.id, host.graphId)
            .map((node) => [node.id, node])
        ),
        inputLink: (node, index) =>
          linkStore.getInputSlotLink(scope, node.id, index),
        widgetIds: (node) => widgetStore.getNodeWidgetIds(root.id, node.id),
        widget: (id) => widgetStore.getWidget(id),
        outputLinkCount: (node, index) =>
          linkStore.getOutputSlotLinks(scope, node.id, index).size
      }
      for (const input of host.inputs) {
        if (input.widgetId)
          result.set(
            input.name,
            resolveInputValueSource(sourceGraph, host, input.name)
          )
      }
      return result
    })
    return { graph, selected, sources }
  }
)
