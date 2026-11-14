import { defineStore } from 'pinia'
import { computed } from 'vue'

import { graphScopeOf } from '@comfyorg/graph-model/graphScopeId'
import { resolveInputValueSource } from '@/core/graph/subgraph/resolveInputValueSource'
import type {
  InputValueSource,
  ValueSourceGraph
} from '@/core/graph/subgraph/resolveInputValueSource'
import { useCanvasStore } from '@/renderer/core/canvas/canvasStore'
import { useLinkStore } from '@/stores/linkStore'
import { useNodeDataStore } from '@/stores/nodeDataStore'
import { useSubgraphNavigationStore } from '@/stores/subgraphNavigationStore'
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
    const graph = computed(() => {
      const current = canvasStore.currentGraph
      return isSubgraph(current) ? current : undefined
    })

    const selected = computed(() => {
      const current = graph.value
      if (!current) return undefined
      const root = current.rootGraph
      const instancesIn = (graphId: UUID) =>
        nodeDataStore
          .getGraphNodesFor(root.id, graphId)
          .filter((node) => node.type === current.id)
      const entered = useSubgraphNavigationStore().enteredHost(current)
      if (entered)
        return instancesIn(entered.graphId).find(
          (node) => node.id === entered.id
        )
      const instances = [root.id, ...root.subgraphs.keys()].flatMap(instancesIn)
      return instances.length === 1 ? instances[0] : undefined
    })

    const sources = computed(() => {
      const host = selected.value
      const root = graph.value?.rootGraph
      const result = new Map<string, InputValueSource>()
      if (!host || !root) return result
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
      for (const [index, { name, widgetId }] of host.inputs.entries()) {
        if (widgetId)
          result.set(
            name,
            resolveInputValueSource(sourceGraph, host, index, widgetId)
          )
      }
      return result
    })
    return { graph, selected, sources }
  }
)
