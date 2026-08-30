<template>
  <Tooltip
    :config="{
      value: $t('commands.Comfy_Graph_EditSubgraphWidgets.label'),
      showDelay: 1000
    }"
    side="top"
  >
    <Button
      variant="muted-textonly"
      :aria-label="$t('commands.Comfy_Graph_EditSubgraphWidgets.label')"
      @click="handleClick"
    >
      <i class="icon-[lucide--settings-2]" />
    </Button>
  </Tooltip>
</template>
<script setup lang="ts">
import Tooltip from '@/components/ui/tooltip/Tooltip.vue'

import Button from '@/components/ui/button/Button.vue'
import { useRightSidePanelStore } from '@/stores/workspace/rightSidePanelStore'

const rightSidePanelStore = useRightSidePanelStore()

const handleClick = () => {
  rightSidePanelStore.openPanel('subgraph')
}
</script>
