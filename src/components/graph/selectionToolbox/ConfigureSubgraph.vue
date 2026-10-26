<template>
  <Button
    :tooltip="$t('commands.Comfy_Graph_EditSubgraphWidgets.label')"
    variant="muted-textonly"
    :aria-label="$t('commands.Comfy_Graph_EditSubgraphWidgets.label')"
    @click="handleClick"
  >
    <i class="icon-[lucide--settings-2] size-[1.2em]" />
  </Button>
</template>
<script setup lang="ts">
import Button from '@comfyorg/design-system/button/Button'
import { useRightSidePanelStore } from '@/stores/workspace/rightSidePanelStore'

const rightSidePanelStore = useRightSidePanelStore()

const handleClick = () => {
  rightSidePanelStore.openPanel('subgraph')
}
</script>
