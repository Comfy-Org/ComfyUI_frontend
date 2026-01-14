<template>
  <div class="imageCanvas_sidePanel">
    <div class="imageCanvas_sidePanelContainer">
      <component :is="currentPanelComponent" />
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { Component } from 'vue'

import { Tools } from '@/extensions/core/imagecanvas/types'
import { useImageCanvasStore } from '@/stores/imageCanvasStore'

import BrushSettingsPanel from './BrushSettingsPanel.vue'
import ColorSelectSettingsPanel from './ColorSelectSettingsPanel.vue'
import PaintBucketSettingsPanel from './PaintBucketSettingsPanel.vue'

const currentPanelComponent = computed<Component>(() => {
  const tool = useImageCanvasStore().currentTool

  if (tool === Tools.MaskBucket) {
    return PaintBucketSettingsPanel
  } else if (tool === Tools.MaskColorFill) {
    return ColorSelectSettingsPanel
  } else {
    return BrushSettingsPanel
  }
})
</script>
