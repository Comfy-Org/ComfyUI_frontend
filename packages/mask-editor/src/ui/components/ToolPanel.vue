<template>
  <div class="flex h-full flex-col justify-between bg-background">
    <div class="flex flex-col">
      <div
        v-for="tool in allTools"
        :key="tool"
        data-testid="tool-button"
        :data-tool="tool"
        :class="
          cn(
            'maskEditor_toolPanelContainer hover:bg-accent',
            !extensionTools?.active.value &&
              currentTool === tool &&
              'maskEditor_toolPanelContainerSelected'
          )
        "
        @click="onToolSelect(tool)"
      >
        <div class="flex items-center justify-center">
          <MaskEditorToolIcon :tool="tool" />
        </div>
        <div class="maskEditor_toolPanelIndicator"></div>
      </div>
      <Button
        v-for="tool in extensionTools?.tools.value"
        :key="tool.id"
        type="button"
        variant="textonly"
        size="unset"
        :aria-label="tool.label"
        :aria-pressed="extensionTools?.active.value?.tool.id === tool.id"
        :title="tool.label"
        :data-tool="tool.id"
        :class="
          cn(
            'maskEditor_toolPanelContainer rounded-none',
            extensionTools?.active.value?.tool.id === tool.id &&
              'maskEditor_toolPanelContainerSelected'
          )
        "
        @click="extensionTools?.activate(tool.id)"
      >
        <i
          :class="cn('size-6', tool.icon ?? 'icon-[lucide--puzzle]')"
          aria-hidden="true"
        />
        <span class="maskEditor_toolPanelIndicator" />
      </Button>
    </div>

    <div
      class="mb-2 flex cursor-pointer flex-col items-center rounded-md text-muted-foreground transition-colors duration-200 hover:bg-accent"
      :title="t('maskEditor.clickToResetZoom')"
      @click="onResetZoom"
    >
      <span data-testid="zoom-percentage" class="text-sm">{{ zoomText }}</span>
      <span data-testid="zoom-dimensions" class="text-xs">{{
        dimensionsText
      }}</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { MaskEditorExtensionTools } from '@/renderer/extensions/maskEditor/composables/useMaskEditorExtensionTools'
import { useI18n } from 'vue-i18n'

import { cn } from '@comfyorg/tailwind-utils'
import Button from '@comfyorg/design-system/button/Button'

import MaskEditorToolIcon from './MaskEditorToolIcon.vue'
import type { useToolManager } from '#/useToolManager'
import type { Tools } from '#/types'
import { allTools } from '#/types'
import { useMaskEditorStore } from '#/maskEditorStore'

const { toolManager, extensionTools } = defineProps<{
  toolManager: ReturnType<typeof useToolManager>
  extensionTools?: MaskEditorExtensionTools
}>()

const { t } = useI18n()
const store = useMaskEditorStore()

const onToolSelect = (tool: Tools) => {
  toolManager.switchTool(tool)
}

const currentTool = computed(() => store.currentTool)

const zoomText = computed(() => `${Math.round(store.displayZoomRatio * 100)}%`)
const dimensionsText = computed(() => {
  const img = store.canvasHistory.dimensions ?? store.image
  return img ? `${img.width}x${img.height}` : ' '
})

const onResetZoom = () => {
  store.resetZoom()
}
</script>
