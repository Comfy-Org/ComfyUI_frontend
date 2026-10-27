<template>
  <Button
    :tooltip="$t('commands.Comfy_3DViewer_Open3DViewer.label')"
    variant="muted-textonly"
    :aria-label="$t('commands.Comfy_3DViewer_Open3DViewer.label')"
    @click="open3DViewer"
  >
    <i class="icon-[lucide--pencil]" />
  </Button>
</template>

<script setup lang="ts">
import Button from '@comfyorg/design-system/button/Button'
import { useCommandStore } from '@/stores/commandStore'

const commandStore = useCommandStore()

const open3DViewer = () => {
  void commandStore.execute('Comfy.3DViewer.Open3DViewer')
}
</script>
