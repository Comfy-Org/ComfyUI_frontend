<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

import type { NodeState } from '@comfyorg/graph-model/nodeState'
import type { InputValueSource } from '@/core/graph/subgraph/resolveInputValueSource'
import { useFocusNode } from '@/composables/canvas/useFocusNode'
import type { Subgraph } from '@/lib/litegraph/src/litegraph'
import { useWorkflowStore } from '@/platform/workflow/management/stores/workflowStore'
import { getNodeByState } from '@/utils/graphTraversalUtil'
import SubgraphInputValue from './SubgraphInputValue.vue'
import SubgraphIoPanel from './SubgraphIoPanel.vue'
import { useSubgraphInputValuesStore } from './subgraphInputValuesStore'

const { graph } = defineProps<{ graph: Subgraph }>()

const { t } = useI18n()
const context = useSubgraphInputValuesStore()
const { focusNodeInstance } = useFocusNode()

const sources = computed(() =>
  context.selected
    ? context.sourcesFor(context.selected)
    : new Map<string, InputValueSource>()
)

const hint = computed(() => {
  if (!context.selected) return t('subgraphInputValues.enterInstanceHint')
  return sources.value.size ? undefined : t('subgraphInputValues.noInputs')
})

async function locate(node: NodeState) {
  const live = getNodeByState(graph.rootGraph, node)
  if (live) await focusNodeInstance(live)
}

function captureEdits() {
  useWorkflowStore().activeWorkflow?.changeTracker.captureCanvasState()
}
</script>

<template>
  <SubgraphIoPanel
    :key="graph.id"
    v-slot="{ slots }"
    :io-node="graph.inputNode"
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
