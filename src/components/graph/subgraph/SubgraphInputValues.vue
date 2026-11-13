<script setup lang="ts">
import SubgraphInputValuesContent from './SubgraphInputValuesContent.vue'
import SubgraphIoPanel from './SubgraphIoPanel.vue'
import { useSubgraphInputValuesStore } from './subgraphInputValuesStore'

const context = useSubgraphInputValuesStore()
</script>

<template>
  <SubgraphIoPanel
    v-if="context.graph"
    v-slot="{ slots }"
    :io-node="context.graph.inputNode"
    data-testid="subgraph-input-values"
  >
    <SubgraphInputValuesContent :slots />
  </SubgraphIoPanel>
</template>
