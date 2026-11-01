<template>
  <div
    class="flex h-full w-55 flex-col items-stretch! gap-3 overflow-y-auto bg-background px-2.5 pb-3"
  >
    <div class="min-h-full w-full">
      <SettingsPanelContainer :extension-tools />

      <div class="mt-6 mb-1.5 h-0.5 w-full bg-border" />

      <ImageLayerSettingsPanel :tool-manager="toolManager" />
    </div>
  </div>
</template>

<script setup lang="ts">
import type { useToolManager } from '@comfyorg/mask-editor/useToolManager'

import ImageLayerSettingsPanel from './ImageLayerSettingsPanel.vue'
import SettingsPanelContainer from './SettingsPanelContainer.vue'
import type { MaskEditorExtensionTools } from '@/renderer/extensions/maskEditor/composables/useMaskEditorExtensionTools'

const { toolManager, extensionTools } = defineProps<{
  toolManager?: ReturnType<typeof useToolManager>
  extensionTools?: MaskEditorExtensionTools
}>()
</script>
