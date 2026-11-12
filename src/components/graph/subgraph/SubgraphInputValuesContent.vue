<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

import { graphScopeOf } from '@comfyorg/graph-model/graphScopeId'
import type { NodeState } from '@comfyorg/graph-model/nodeState'
import { resolveInputValueSource } from '@/core/graph/subgraph/resolveInputValueSource'
import type {
  InputValueSource,
  ValueSourceGraph
} from '@/core/graph/subgraph/resolveInputValueSource'
import type { SubgraphInput } from '@/lib/litegraph/src/subgraph/SubgraphInput'
import { useWorkflowStore } from '@/platform/workflow/management/stores/workflowStore'
import { useCanvasStore } from '@/renderer/core/canvas/canvasStore'
import { useSlotLinkDragUIState } from '@/renderer/core/canvas/links/slotLinkDragUIState'
import { useLinkStore } from '@/stores/linkStore'
import { useNodeDataStore } from '@/stores/nodeDataStore'
import { useSubgraphNavigationStore } from '@/stores/subgraphNavigationStore'
import { useWidgetValueStore } from '@/stores/widgetValueStore'
import { getNodeByState } from '@/utils/graphTraversalUtil'
import { useSubgraphInputValuesStore } from './subgraphInputValuesStore'
import SubgraphInputValue from './SubgraphInputValue.vue'

const { slots, collapsed } = defineProps<{
  slots: SubgraphInput[]
  collapsed: boolean
}>()

const { t } = useI18n()
const context = useSubgraphInputValuesStore()
const nodeStore = useNodeDataStore()
const linkStore = useLinkStore()
const widgetStore = useWidgetValueStore()
const canvasStore = useCanvasStore()
const navigation = useSubgraphNavigationStore()
const { state: linkDrag } = useSlotLinkDragUIState()

const draggedFrom = computed(() =>
  linkDrag.active
    ? canvasStore.canvas?.linkConnector.renderLinks[0]?.fromSlot
    : undefined
)

const sources = computed(() => {
  const { graph, selected: host } = context
  const result = new Map<string, InputValueSource>()
  if (!graph || !host) return result
  const root = graph.rootGraph
  const hostGraph =
    host.graphId === root.id ? root : root.subgraphs.get(host.graphId)
  if (!hostGraph) return result
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
  for (const input of host.inputs) {
    if (input.widgetId)
      result.set(
        input.name,
        resolveInputValueSource(sourceGraph, host, input.name)
      )
  }
  return result
})

const hint = computed(() => {
  if (collapsed) return undefined
  if (!context.selected) return t('subgraphInputValues.enterInstanceHint')
  return sources.value.size ? undefined : t('subgraphInputValues.noInputs')
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
    class="flex min-h-0 flex-1 flex-col gap-(--node-widget-gap) pt-1 pr-4 pb-3"
    @contextmenu.prevent
    @focusout="captureEdits"
  >
    <SubgraphInputValue
      v-for="slot in slots"
      :key="`${context.selected?.graphId}:${context.selected?.id}:${slot.id}`"
      :port="slot"
      :label="slot.displayName"
      :is-add-port="slot === context.graph?.inputNode.emptySlot"
      :dimmed="!!draggedFrom && !slot.isValidTarget(draggedFrom)"
      :collapsed
      :host="context.selected"
      :source="sources.get(slot.name)"
      @locate="locate"
    />
    <p v-if="hint" class="mx-3 my-0 text-muted-foreground">
      {{ hint }}
    </p>
  </div>
</template>
