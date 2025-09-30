<template>
  <Button
    v-tooltip.top="{
      value: $t('Edit Subgraph Widgets'),
      showDelay: 1000
    }"
    severity="secondary"
    text
    @click="showSubgraphNodeDialog"
  >
    <i-lucide:settings2 />
  </Button>
</template>

<script setup lang="ts">
import Button from 'primevue/button'

import { showSubgraphNodeDialog } from '@/core/graph/subgraph/useSubgraphNodeDialog'
</script>
