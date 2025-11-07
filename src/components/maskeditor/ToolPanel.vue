<template>
  <div
    class="h-full z-[8888] flex flex-col justify-between bg-[var(--comfy-menu-bg)]"
  >
    <div class="flex flex-col">
      <div
        v-for="tool in allTools"
        :key="tool"
        :class="[
          'maskEditor_toolPanelContainer hover:bg-[var(--p-surface-300)] dark-theme:hover:bg-[var(--p-surface-800)]',
          { maskEditor_toolPanelContainerSelected: currentTool === tool }
        ]"
        @click="onToolSelect(tool)"
      >
        <div
          class="flex items-center justify-center"
          v-html="iconsHtml[tool]"
        ></div>
        <div class="maskEditor_toolPanelIndicator"></div>
      </div>
    </div>

    <div
      class="flex flex-col items-center cursor-pointer rounded-md mb-2 transition-colors duration-200 hover:bg-[var(--p-surface-300)] dark-theme:hover:bg-[var(--p-surface-800)]"
      :title="t('maskEditor.clickToResetZoom')"
      @click="onResetZoom"
    >
      <span class="text-sm text-[var(--p-button-text-secondary-color)]">{{
        zoomText
      }}</span>
      <span class="text-xs text-[var(--p-button-text-secondary-color)]">{{
        dimensionsText
      }}</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'

import type { useToolManager } from '@/composables/maskeditor/useToolManager'
import { iconsHtml } from '@/extensions/core/maskeditor/constants'
import type { Tools } from '@/extensions/core/maskeditor/types'
import { allTools } from '@/extensions/core/maskeditor/types'
import { t } from '@/i18n'
import { useMaskEditorStore } from '@/stores/maskEditorStore'

const { toolManager } = defineProps<{
  toolManager: ReturnType<typeof useToolManager>
}>()

const store = useMaskEditorStore()

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
