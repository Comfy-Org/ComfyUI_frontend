<script setup lang="ts">
import type { Subgraph } from '@/lib/litegraph/src/litegraph'
import SubgraphIoLabel from './SubgraphIoLabel.vue'
import SubgraphIoPanel from './SubgraphIoPanel.vue'
import SubgraphIoPort from './SubgraphIoPort.vue'

const { graph } = defineProps<{ graph: Subgraph }>()
</script>

<template>
  <SubgraphIoPanel
    :key="graph.id"
    v-slot="{ slots }"
    :io-node="graph.outputNode"
    data-testid="subgraph-output-ports"
  >
    <div v-for="slot in slots" :key="slot.id" data-subgraph-port class="flex">
      <SubgraphIoPort :port="slot" :label="slot.displayName" />
      <SubgraphIoLabel
        v-if="slot !== graph.outputNode.emptySlot"
        :label="slot.displayName"
      />
    </div>
  </SubgraphIoPanel>
</template>
