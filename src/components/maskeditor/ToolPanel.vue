<template>
  <div class="z-8888 flex h-full flex-col bg-comfy-menu-bg">
    <div class="flex flex-col">
      <div
        v-for="tool in allTools"
        :key="tool"
        v-tooltip.right="{
          value: tooltips[tool],
          showDelay: 300,
          hideDelay: 300
        }"
        :class="[
          'maskEditor_toolPanelContainer',
          { maskEditor_toolPanelContainerSelected: currentTool === tool }
        ]"
        @click="onToolSelect(tool)"
      >
        <div
          class="flex items-center justify-center"
          v-html="iconsHtml[tool]"
        ></div>
      </div>
    </div>

    <div class="mt-auto flex flex-col items-center">
      <!-- Color Selector -->
      <div
        v-if="currentTool !== Tools.MaskPen"
        class="mb-3 flex justify-center"
      >
        <div
          class="relative flex size-12 cursor-pointer items-center justify-center rounded-[10px] p-1"
        >
          <input
            ref="colorInputRef"
            v-model="store.rgbColor"
            type="color"
            class="size-8 cursor-pointer appearance-none rounded-[6px] border-none p-0"
            :style="{ backgroundColor: store.rgbColor }"
          />
        </div>
      </div>

      <div
        class="mb-2 flex size-12 cursor-pointer flex-col items-center justify-center rounded-md transition-colors duration-200 hover:bg-secondary-background-hover"
        :title="t('maskEditor.clickToResetZoom')"
        @click="onResetZoom"
      >
        <span class="text-sm text-text-secondary">{{ zoomText }}</span>
        <span class="text-xs text-text-secondary">{{ dimensionsText }}</span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'

import type { useToolManager } from '@/composables/maskeditor/useToolManager'
import { iconsHtml } from '@/extensions/core/maskeditor/constants'
import { Tools, allTools } from '@/extensions/core/maskeditor/types'
import { useMaskEditorStore } from '@/stores/maskEditorStore'

const { toolManager } = defineProps<{
  toolManager: ReturnType<typeof useToolManager>
}>()

const { t } = useI18n()
const store = useMaskEditorStore()

const tooltips: Record<Tools, string> = {
  [Tools.MaskPen]: t('maskEditor.toolPen'),
  [Tools.PaintPen]: t('maskEditor.toolPaintPen'),
  [Tools.Eraser]: t('maskEditor.toolEraser'),
  [Tools.MaskBucket]: t('maskEditor.toolPaintBucket'),
  [Tools.MaskColorFill]: t('maskEditor.toolColorSelect')
}

const onToolSelect = (tool: Tools) => {
  toolManager.switchTool(tool)
}

const colorInputRef = ref<HTMLInputElement>()

const currentTool = computed(() => store.currentTool)

const zoomText = computed(() => `${Math.round(store.displayZoomRatio * 100)}%`)
const dimensionsText = computed(() => {
  const img = store.image
  return img ? `${img.width}x${img.height}` : ' '
})

const onResetZoom = () => {
  store.resetZoom()
}

onMounted(() => {
  if (colorInputRef.value) {
    store.colorInput = colorInputRef.value
  }
})

onBeforeUnmount(() => {
  store.colorInput = null
})
</script>

<style scoped>
input[type='color']::-webkit-color-swatch {
  border: none;
  border-radius: 10px;
}
input[type='color']::-moz-color-swatch {
  border: none;
  border-radius: 10px;
}
</style>
