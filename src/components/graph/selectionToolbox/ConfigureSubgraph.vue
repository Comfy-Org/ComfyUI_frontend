<template>
  <Button
    v-tooltip.top="{
      value: $t('commands.Comfy_Graph_EditSubgraphWidgets.label'),
      showDelay: 1000
    }"
    variant="textonly"
    size="icon"
    @click="handleClick"
  >
    <i class="icon-[lucide--settings-2] size-4" />
  </Button>
</template>
<script setup lang="ts">
import Button from '@/components/ui/button/Button.vue'
import { useRightSidePanelStore } from '@/stores/workspace/rightSidePanelStore'

const rightSidePanelStore = useRightSidePanelStore()

const handleClick = () => {
  rightSidePanelStore.openPanel('subgraph')
}
</script>
