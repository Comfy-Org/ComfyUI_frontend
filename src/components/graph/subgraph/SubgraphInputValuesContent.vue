<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

import { graphScopeOf } from '@comfyorg/graph-model/graphScopeId'
import type { NodeState } from '@comfyorg/graph-model/nodeState'
import { resolveInputValueSource } from '@/core/graph/subgraph/resolveInputValueSource'
import type { ValueSourceGraph } from '@/core/graph/subgraph/resolveInputValueSource'
import { useWorkflowStore } from '@/platform/workflow/management/stores/workflowStore'
import { useCanvasStore } from '@/renderer/core/canvas/canvasStore'
import { useLinkStore } from '@/stores/linkStore'
import { useNodeDataStore } from '@/stores/nodeDataStore'
import { useSubgraphNavigationStore } from '@/stores/subgraphNavigationStore'
import { useWidgetValueStore } from '@/stores/widgetValueStore'
import { getNodeByState } from '@/utils/graphTraversalUtil'
import { useSubgraphInputValuesStore } from './subgraphInputValuesStore'
import SubgraphInputValue from './SubgraphInputValue.vue'

const { t } = useI18n()
const context = useSubgraphInputValuesStore()
const nodeStore = useNodeDataStore()
const linkStore = useLinkStore()
const widgetStore = useWidgetValueStore()
const canvasStore = useCanvasStore()
const navigation = useSubgraphNavigationStore()

const rows = computed(() => {
  const { graph, selected: host } = context
  if (!graph || !host) return []
  const root = graph.rootGraph
  const hostGraph =
    host.graphId === root.id ? root : root.subgraphs.get(host.graphId)
  if (!hostGraph) return []
  const scope = graphScopeOf(hostGraph)
  const sourceGraph: ValueSourceGraph = {
    nodes: new Map(
      nodeStore
        .getGraphNodesFor(root.id, hostGraph.id)
        .map((node) => [node.id, node])
    ),
    inputLink: (node, index) =>
      linkStore.getInputSlotLink(scope, node.id, index),
    widgetIds: (node) => widgetStore.getNodeWidgetIds(root.id, node.id),
    widget: (id) => widgetStore.getWidget(id),
    outputLinkCount: (node, index) =>
      linkStore.getOutputSlotLinks(scope, node.id, index).size
  }
  return host.inputs.flatMap((input) =>
    input.widgetId
      ? [
          {
            name: input.name,
            label: input.label ?? input.name,
            source: resolveInputValueSource(sourceGraph, host, input.name)
          }
        ]
      : []
  )
})

async function locate(node: NodeState) {
  const root = context.graph?.rootGraph
  const owner = root && getNodeByState(root, node)
  const canvas = canvasStore.canvas
  if (!owner?.graph || !canvas) return
  if (await navigation.navigateToGraph(owner.graph)) {
    canvas.animateToBounds(owner.boundingRect)
  }
}

function captureEdits() {
  useWorkflowStore().activeWorkflow?.changeTracker.captureCanvasState()
}
</script>

<template>
  <div
    class="flex min-h-0 flex-1 flex-col gap-(--node-widget-gap)"
    @contextmenu.prevent
    @focusout="captureEdits"
  >
    <template v-if="context.selected">
      <SubgraphInputValue
        v-for="row in rows"
        :key="`${context.selected.graphId}:${context.selected.id}:${row.name}`"
        :label="row.label"
        :host="context.selected"
        :source="row.source"
        @locate="locate"
      />
      <p v-if="!rows.length" class="mx-3 my-0 text-muted-foreground">
        {{ t('subgraphInputValues.noInputs') }}
      </p>
    </template>
    <p v-else class="mx-3 my-0 text-muted-foreground">
      {{ t('subgraphInputValues.enterInstanceHint') }}
    </p>
  </div>
</template>
