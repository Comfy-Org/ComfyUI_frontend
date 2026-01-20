<template>
  <div
    class="flex h-full w-55 flex-col !items-stretch gap-3 overflow-y-auto bg-[var(--comfy-menu-bg)] px-2.5 pb-3"
  >
    <div class="min-h-full w-full">
      <SettingsPanelContainer />

      <div class="mt-6 mb-1.5 h-0.5 w-full bg-[var(--border-color)]" />

      <ImageLayerSettingsPanel :tool-manager="toolManager" />
    </div>
  </div>
</template>

<script setup lang="ts">
import type { useToolManager } from '@/composables/maskeditor/useToolManager'

import ImageLayerSettingsPanel from './ImageLayerSettingsPanel.vue'
import SettingsPanelContainer from './SettingsPanelContainer.vue'

const { toolManager } = defineProps<{
  toolManager?: ReturnType<typeof useToolManager>
}>()
</script>
