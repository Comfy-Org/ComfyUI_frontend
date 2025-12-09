<template>
  <Button
    v-tooltip.top="{
      value: $t('commands.Comfy_Graph_EditSubgraphWidgets.label'),
      showDelay: 1000
    }"
    severity="secondary"
    text
    icon="icon-[lucide--settings-2]"
    @click="handleClick"
  />
</template>
<script setup lang="ts">
import Button from 'primevue/button'

import { useRightSidePanelStore } from '@/stores/workspace/rightSidePanelStore'

const rightSidePanelStore = useRightSidePanelStore()

const handleClick = () => {
  rightSidePanelStore.openPanel('subgraph')
}
</script>
