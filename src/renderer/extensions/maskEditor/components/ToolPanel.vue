<template>
  <div class="flex h-full flex-col bg-background">
    <div class="flex flex-col">
      <button
        v-for="tool in allTools"
        :key="tool"
        type="button"
        data-testid="tool-button"
        :data-tool="tool"
        :aria-label="tooltips[tool]"
        :aria-pressed="currentTool === tool"
        :class="
          cn(
            'maskEditor_toolPanelContainer',
            currentTool === tool && 'maskEditor_toolPanelContainerSelected'
          )
        "
        @click="onToolSelect(tool)"
      >
        <span class="flex items-center justify-center">
          <MaskEditorToolIcon :tool="tool" />
        </span>
      </button>
    </div>

    <div class="mt-auto flex flex-col items-center">
      <div v-if="showColorPicker" class="mb-3 flex justify-center">
        <div
          class="relative flex size-12 cursor-pointer items-center justify-center rounded-[10px] p-1"
        >
          <input
            ref="colorInputRef"
            v-model="store.rgbColor"
            type="color"
            :aria-label="t('maskEditor.colorSelector')"
            class="size-8 cursor-pointer overflow-hidden rounded-[6px] border-none bg-transparent p-0 [&::-moz-color-swatch]:rounded-[6px] [&::-moz-color-swatch]:border-none [&::-webkit-color-swatch]:rounded-[6px] [&::-webkit-color-swatch]:border-none [&::-webkit-color-swatch-wrapper]:p-0"
          />
        </div>
      </div>

      <Button
        variant="textonly"
        size="unset"
        class="mb-2 flex size-12 flex-col items-center justify-center gap-0 rounded-md border-none font-normal whitespace-normal text-muted-foreground transition-colors duration-200"
        @click="onResetZoom"
      >
        <span class="sr-only">{{ t('maskEditor.clickToResetZoom') }}</span>
        <span data-testid="zoom-percentage" class="text-sm">{{
          zoomText
        }}</span>
        <span data-testid="zoom-dimensions" class="text-xs">{{
          dimensionsText
        }}</span>
      </Button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, useTemplateRef, watchEffect } from 'vue'
import { useI18n } from 'vue-i18n'

import MaskEditorToolIcon from '@/renderer/extensions/maskEditor/components/MaskEditorToolIcon.vue'
import type { useToolManager } from '@comfyorg/mask-editor/useToolManager'
import type { Tools as ToolName } from '@comfyorg/mask-editor/types'
import { Tools, allTools } from '@comfyorg/mask-editor/types'
import { useMaskEditorStore } from '@comfyorg/mask-editor/maskEditorStore'
import Button from '@comfyorg/design-system/button/Button'
import { cn } from '@comfyorg/tailwind-utils'

const { toolManager } = defineProps<{
  toolManager: ReturnType<typeof useToolManager>
}>()

const { t } = useI18n()
const store = useMaskEditorStore()
const colorInputRef = useTemplateRef<HTMLInputElement>('colorInputRef')

const tooltips = computed((): Record<ToolName, string> => ({
  [Tools.MaskPen]: t('maskEditor.toolPen'),
  [Tools.PaintPen]: t('maskEditor.toolPaintPen'),
  [Tools.Eraser]: t('maskEditor.toolEraser'),
  [Tools.MaskBucket]: t('maskEditor.toolPaintBucket'),
  [Tools.MaskColorFill]: t('maskEditor.toolColorSelect')
}))

function onToolSelect(tool: ToolName) {
  toolManager.switchTool(tool)
}

const currentTool = computed(() => store.currentTool)
const showColorPicker = computed(() => currentTool.value === Tools.PaintPen)

const zoomText = computed(() => `${Math.round(store.displayZoomRatio * 100)}%`)
const dimensionsText = computed(() => {
  const img = store.image
  return img ? `${img.width}x${img.height}` : ' '
})

function onResetZoom() {
  store.resetZoom()
}

watchEffect(
  () => {
    store.colorInput = colorInputRef.value ?? null
  },
  { flush: 'post' }
)

onBeforeUnmount(() => {
  store.colorInput = null
})
</script>
