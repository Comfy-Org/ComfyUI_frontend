import { computed } from 'vue'
import type { NodeState } from '@comfyorg/graph-model/nodeState'
import { useCanvasStore } from '@/renderer/core/canvas/canvasStore'
import { useSubgraphNavigationStore } from '@/stores/subgraphNavigationStore'
import { getNodeByState } from '@/utils/graphTraversalUtil'

import { resolveInputValueSource } from '@/core/graph/subgraph/resolveInputValueSource'
import type { ValueSourceGraph } from '@/core/graph/subgraph/resolveInputValueSource'
import { graphScopeOf } from '@comfyorg/graph-model/graphScopeId'
import { useLinkStore } from '@/stores/linkStore'
import { useNodeDataStore } from '@/stores/nodeDataStore'
import { useSubgraphInputValuesStore } from './subgraphInputValuesStore'
import { useWidgetValueStore } from '@/stores/widgetValueStore'

export function useSubgraphInputValues() {
  const context = useSubgraphInputValuesStore()
  const nodeStore = useNodeDataStore()
  const linkStore = useLinkStore()
  const widgetStore = useWidgetValueStore()
  const canvasStore = useCanvasStore()
  const navigation = useSubgraphNavigationStore()

  const sourceGraph = computed<ValueSourceGraph | undefined>(() => {
    const { graph, selected } = context
    if (!graph || !selected) return
    const root = graph.rootGraph
    const owner =
      selected.graphId === root.id ? root : root.subgraphs.get(selected.graphId)
    if (!owner) return
    const scope = graphScopeOf(owner)
    return {
      scope,
      nodes: new Map(
        nodeStore
          .getGraphNodesFor(root.id, owner.id)
          .map((node) => [node.id, node])
      ),
      inputLink: (node, index) =>
        linkStore.getInputSlotLink(scope, node.id, index),
      widgetIds: (node) => widgetStore.getNodeWidgetIds(root.id, node.id),
      widget: (id) => widgetStore.getWidget(id),
      outputLinkCount: (node, index) =>
        linkStore.getOutputSlotLinks(scope, node.id, index).size
    }
  })

  const rows = computed(
    () =>
      context.selected?.inputs.flatMap((input) =>
        input.widgetId
          ? [{ name: input.name, label: input.label ?? input.name }]
          : []
      ) ?? []
  )

  function resolve(inputName: string) {
    const graph = sourceGraph.value
    const host = context.selected
    return graph && host
      ? resolveInputValueSource(graph, host, inputName)
      : ({ kind: 'unavailable' } as const)
  }

  async function locate(node: NodeState) {
    const root = context.graph?.rootGraph
    const owner = root && getNodeByState(root, node)
    const canvas = canvasStore.canvas
    if (!owner?.graph || !canvas) return
    if (await navigation.navigateToGraph(owner.graph)) {
      canvas.animateToBounds(owner.boundingRect)
    }
  }

  return { rows, resolve, locate }
}
