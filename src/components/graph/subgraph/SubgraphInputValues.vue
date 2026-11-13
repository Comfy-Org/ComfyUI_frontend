<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

import { graphScopeOf } from '@comfyorg/graph-model/graphScopeId'
import type { NodeState } from '@comfyorg/graph-model/nodeState'
import { useFocusNode } from '@/composables/canvas/useFocusNode'
import { resolveInputValueSource } from '@/core/graph/subgraph/resolveInputValueSource'
import type {
  InputValueSource,
  ValueSourceGraph
} from '@/core/graph/subgraph/resolveInputValueSource'
import { useWorkflowStore } from '@/platform/workflow/management/stores/workflowStore'
import { useCanvasStore } from '@/renderer/core/canvas/canvasStore'
import { useLinkStore } from '@/stores/linkStore'
import { useNodeDataStore } from '@/stores/nodeDataStore'
import { useWidgetValueStore } from '@/stores/widgetValueStore'
import { getNodeByState } from '@/utils/graphTraversalUtil'
import SubgraphInputValue from './SubgraphInputValue.vue'
import SubgraphIoPanel from './SubgraphIoPanel.vue'
import { useSubgraphInputValuesStore } from './subgraphInputValuesStore'

const { t } = useI18n()
const context = useSubgraphInputValuesStore()
const canvasStore = useCanvasStore()
const nodeStore = useNodeDataStore()
const linkStore = useLinkStore()
const widgetStore = useWidgetValueStore()
const { focusNodeInstance } = useFocusNode()

const sources = computed(() => {
  const { graph, selected: host } = context
  const result = new Map<string, InputValueSource>()
  if (!graph || !host) return result
  const root = graph.rootGraph
  const scope = graphScopeOf({ id: host.graphId, rootGraph: root })
  const sourceGraph: ValueSourceGraph = {
    nodes: new Map(
      nodeStore
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

const hint = computed(() => {
  if (!context.selected) return t('subgraphInputValues.enterInstanceHint')
  return sources.value.size ? undefined : t('subgraphInputValues.noInputs')
})

async function locate(node: NodeState) {
  const root = context.graph?.rootGraph
  const live = root && getNodeByState(root, node)
  if (live) await focusNodeInstance(live)
}

function captureEdits() {
  useWorkflowStore().activeWorkflow?.changeTracker.captureCanvasState()
}
</script>

<template>
  <SubgraphIoPanel
    v-if="context.graph && !canvasStore.linearMode"
    :key="context.graph.id"
    v-slot="{ slots }"
    :io-node="context.graph.inputNode"
    data-testid="subgraph-input-values"
  >
    <div class="contents" @focusout="captureEdits">
      <SubgraphInputValue
        v-for="slot in slots"
        :key="slot.id"
        :port="slot"
        :label="slot.displayName"
        :host="context.selected"
        :source="sources.get(slot.name)"
        @locate="locate"
      />
      <p v-if="hint" class="mx-3 my-0 text-muted-foreground">
        {{ hint }}
      </p>
    </div>
  </SubgraphIoPanel>
</template>
