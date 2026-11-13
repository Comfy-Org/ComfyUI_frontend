<script setup lang="ts">
import { useCanvasStore } from '@/renderer/core/canvas/canvasStore'
import SubgraphIoLabel from './SubgraphIoLabel.vue'
import SubgraphIoPanel from './SubgraphIoPanel.vue'
import SubgraphIoPort from './SubgraphIoPort.vue'
import { useSubgraphInputValuesStore } from './subgraphInputValuesStore'

const context = useSubgraphInputValuesStore()
const canvasStore = useCanvasStore()
</script>

<template>
  <SubgraphIoPanel
    v-if="context.graph && !canvasStore.linearMode"
    :key="context.graph.id"
    v-slot="{ slots }"
    :io-node="context.graph.outputNode"
    data-testid="subgraph-output-ports"
  >
    <div v-for="slot in slots" :key="slot.id" data-subgraph-port class="flex">
      <SubgraphIoPort :port="slot" :label="slot.displayName" />
      <SubgraphIoLabel
        v-if="slot !== context.graph.outputNode.emptySlot"
        :label="slot.displayName"
      />
    </div>
  </SubgraphIoPanel>
</template>
