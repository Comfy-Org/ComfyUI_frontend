<template>
  <div
    class="flex h-full w-56 flex-col divide-y divide-border/50 overflow-y-auto border-l border-border/50 bg-background px-3"
  >
    <SettingsPanelContainer />
    <ImageLayerSettingsPanel :tool-manager="toolManager" />
  </div>
</template>

<script setup lang="ts">
import type { useToolManager } from '@comfyorg/mask-editor/useToolManager'

import ImageLayerSettingsPanel from './ImageLayerSettingsPanel.vue'
import SettingsPanelContainer from './SettingsPanelContainer.vue'

const { toolManager } = defineProps<{
  toolManager?: ReturnType<typeof useToolManager>
}>()
</script>
