<template>
  <Tooltip
    :config="{
      value: $t('commands.Comfy_3DViewer_Open3DViewer.label'),
      showDelay: 1000
    }"
    side="top"
  >
    <Button
      variant="muted-textonly"
      :aria-label="$t('commands.Comfy_3DViewer_Open3DViewer.label')"
      @click="open3DViewer"
    >
      <i class="icon-[lucide--pencil]" />
    </Button>
  </Tooltip>
</template>

<script setup lang="ts">
import Tooltip from '@/components/ui/tooltip/Tooltip.vue'

import Button from '@/components/ui/button/Button.vue'
import { useCommandStore } from '@/stores/commandStore'

const commandStore = useCommandStore()

const open3DViewer = () => {
  void commandStore.execute('Comfy.3DViewer.Open3DViewer')
}
</script>
