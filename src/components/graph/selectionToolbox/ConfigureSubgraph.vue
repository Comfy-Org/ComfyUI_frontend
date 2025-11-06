<template>
  <Button
    v-tooltip.top="{
      value: $t('commands.Comfy_Graph_EditSubgraphWidgets.label'),
      showDelay: 1000
    }"
    severity="secondary"
    text
    icon="icon-[lucide--settings-2]"
    @click="showSubgraphNodeDialog"
  />
</template>
<script setup lang="ts">
import Button from 'primevue/button'

import { showSubgraphNodeDialog } from '@/core/graph/subgraph/useSubgraphNodeDialog'
</script>
