import { defineStore } from 'pinia'
import { computed } from 'vue'

import { graphScopeOf } from '@comfyorg/graph-model/graphScopeId'
import type { NodeState } from '@comfyorg/graph-model/nodeState'
import { resolveInputValueSource } from '@/core/graph/subgraph/resolveInputValueSource'
import type { InputValueSource } from '@/core/graph/subgraph/resolveInputValueSource'
import { useCanvasStore } from '@/renderer/core/canvas/canvasStore'
import { useNodeDataStore } from '@/stores/nodeDataStore'
import { useSubgraphNavigationStore } from '@/stores/subgraphNavigationStore'
import { isSubgraph } from '@/utils/typeGuardUtil'
import type { UUID } from '@/utils/uuid'

export const useSubgraphInputValuesStore = defineStore(
  'subgraphInputValues',
  () => {
    const canvasStore = useCanvasStore()
    const nodeDataStore = useNodeDataStore()
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
      if (entered) {
        const host = nodeDataStore.getNode(root.id, entered.id)
        return host?.graphId === entered.graphId && host.type === current.id
          ? host
          : undefined
      }
      const instances = [root.id, ...root.subgraphs.keys()].flatMap(instancesIn)
      return instances.length === 1 ? instances[0] : undefined
    })

    function sourcesFor(host: NodeState): Map<string, InputValueSource> {
      const result = new Map<string, InputValueSource>()
      const rootGraphId = canvasStore.rootGraphId
      if (!rootGraphId) return result
      const scope = graphScopeOf({
        id: host.graphId,
        rootGraph: { id: rootGraphId }
      })
      for (const [index, { name, widgetId }] of host.inputs.entries()) {
        if (widgetId)
          result.set(
            name,
            resolveInputValueSource(scope, host, index, widgetId)
          )
      }
      return result
    }
    return { graph, selected, sourcesFor }
  }
)
