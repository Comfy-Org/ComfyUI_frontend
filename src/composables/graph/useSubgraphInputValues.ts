import { computed } from 'vue'

import { resolveInputValueSource } from '@/core/graph/subgraph/resolveInputValueSource'
import type { ValueSourceGraph } from '@/core/graph/subgraph/resolveInputValueSource'
import { graphScopeOf } from '@comfyorg/graph-model/graphScopeId'
import { useLinkStore } from '@/stores/linkStore'
import { useNodeDataStore } from '@/stores/nodeDataStore'
import { useSubgraphInputValuesStore } from '@/stores/subgraphInputValuesStore'
import { useWidgetValueStore } from '@/stores/widgetValueStore'

export function useSubgraphInputValues() {
  const context = useSubgraphInputValuesStore()
  const nodeStore = useNodeDataStore()
  const linkStore = useLinkStore()
  const widgetStore = useWidgetValueStore()

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
      widget: (id) => widgetStore.getWidget(id)
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

  function isShared(inputName: string): boolean {
    const source = resolve(inputName)
    const graph = sourceGraph.value
    return (
      !!graph &&
      source.kind === 'editable' &&
      source.node !== context.selected &&
      linkStore.getOutputSlotLinks(graph.scope, source.node.id, 0).size > 1
    )
  }

  return { rows, resolve, isShared }
}
