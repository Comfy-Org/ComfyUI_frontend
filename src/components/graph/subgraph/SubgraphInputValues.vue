<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

import type { NodeState } from '@comfyorg/graph-model/nodeState'
import { useFocusNode } from '@/composables/canvas/useFocusNode'
import { useWorkflowStore } from '@/platform/workflow/management/stores/workflowStore'
import { useCanvasStore } from '@/renderer/core/canvas/canvasStore'
import { getNodeByState } from '@/utils/graphTraversalUtil'
import SubgraphInputValue from './SubgraphInputValue.vue'
import SubgraphIoPanel from './SubgraphIoPanel.vue'
import { useSubgraphInputValuesStore } from './subgraphInputValuesStore'

const { t } = useI18n()
const context = useSubgraphInputValuesStore()
const canvasStore = useCanvasStore()
const { focusNodeInstance } = useFocusNode()

const hint = computed(() => {
  if (!context.selected) return t('subgraphInputValues.enterInstanceHint')
  return context.sources.size ? undefined : t('subgraphInputValues.noInputs')
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
        :source="context.sources.get(slot.name)"
        @locate="locate"
      />
      <p v-if="hint" class="mx-3 my-0 text-muted-foreground">
        {{ hint }}
      </p>
    </div>
  </SubgraphIoPanel>
</template>
