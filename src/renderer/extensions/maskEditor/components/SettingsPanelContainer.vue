<template>
  <div class="maskEditor_sidePanel">
    <div class="maskEditor_sidePanelContainer">
      <ExtensionToolPanel
        v-if="extensionTools?.active.value"
        :runtime="extensionTools.active.value.runtime"
      />
      <component :is="currentPanelComponent" v-else />
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { Component } from 'vue'

import { Tools } from '@comfyorg/mask-editor/types'
import { useMaskEditorStore } from '@comfyorg/mask-editor/maskEditorStore'

import BrushSettingsPanel from './BrushSettingsPanel.vue'
import ColorSelectSettingsPanel from './ColorSelectSettingsPanel.vue'
import PaintBucketSettingsPanel from './PaintBucketSettingsPanel.vue'
import ExtensionToolPanel from './ExtensionToolPanel.vue'
import type { MaskEditorExtensionTools } from '@/renderer/extensions/maskEditor/composables/useMaskEditorExtensionTools'

const { extensionTools } = defineProps<{
  extensionTools?: MaskEditorExtensionTools
}>()

const currentPanelComponent = computed<Component>(() => {
  const tool = useMaskEditorStore().currentTool

  if (tool === Tools.MaskBucket) {
    return PaintBucketSettingsPanel
  } else if (tool === Tools.MaskColorFill) {
    return ColorSelectSettingsPanel
  } else {
    return BrushSettingsPanel
  }
})
</script>
