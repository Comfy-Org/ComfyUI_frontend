<template>
  <div class="h-full z-8888 flex flex-col justify-between bg-comfy-menu-bg">
    <div class="flex flex-col">
      <div
        v-for="tool in allTools"
        :key="tool"
        :class="[
          'imageCanvas_toolPanelContainer hover:bg-secondary-background-hover',
          { imageCanvas_toolPanelContainerSelected: currentTool === tool }
        ]"
        @click="onToolSelect(tool)"
      >
        <div
          class="flex items-center justify-center"
          v-html="iconsHtml[tool]"
        ></div>
        <div class="imageCanvas_toolPanelIndicator"></div>
      </div>
    </div>

    <div
      class="flex flex-col items-center cursor-pointer rounded-md mb-2 transition-colors duration-200 hover:bg-secondary-background-hover"
      :title="t('imageCanvas.clickToResetZoom')"
      @click="onResetZoom"
    >
      <span class="text-sm text-text-secondary">{{ zoomText }}</span>
      <span class="text-xs text-text-secondary">{{ dimensionsText }}</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'

import type { useToolManager } from '@/composables/imageCanvas/useToolManager'
import { iconsHtml } from '@/extensions/core/imageCanvas/constants'
import type { Tools } from '@/extensions/core/imageCanvas/types'
import { allTools } from '@/extensions/core/imageCanvas/types'
import { t } from '@/i18n'
import { useimageCanvasStore } from '@/stores/imageCanvasStore'

const { toolManager } = defineProps<{
  toolManager: ReturnType<typeof useToolManager>
}>()

const store = useimageCanvasStore()

const onToolSelect = (tool: Tools) => {
  toolManager.switchTool(tool)
}

const currentTool = computed(() => store.currentTool)

const zoomText = computed(() => `${Math.round(store.displayZoomRatio * 100)}%`)
const dimensionsText = computed(() => {
  const img = store.image
  return img ? `${img.width}x${img.height}` : ' '
})

const onResetZoom = () => {
  store.resetZoom()
}
</script>
