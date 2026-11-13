<script setup lang="ts">
import SubgraphIoLabel from './SubgraphIoLabel.vue'
import SubgraphIoPanel from './SubgraphIoPanel.vue'
import SubgraphIoPort from './SubgraphIoPort.vue'
import { useSubgraphInputValuesStore } from './subgraphInputValuesStore'

const context = useSubgraphInputValuesStore()
</script>

<template>
  <SubgraphIoPanel
    v-if="context.graph"
    v-slot="{ slots }"
    :io-node="context.graph.outputNode"
    data-testid="subgraph-output-ports"
  >
    <div v-for="slot in slots" :key="slot.id" data-subgraph-port class="flex">
      <template v-if="slot === context.graph.outputNode.emptySlot">
        <SubgraphIoPort :port="slot" data-testid="subgraph-add-output" />
      </template>
      <template v-else>
        <SubgraphIoPort
          :port="slot"
          data-testid="subgraph-output-port"
          :aria-label="slot.displayName"
        />
        <SubgraphIoLabel :label="slot.displayName" />
      </template>
    </div>
  </SubgraphIoPanel>
</template>
