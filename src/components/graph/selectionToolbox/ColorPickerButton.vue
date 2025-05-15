<template>
  <div class="relative">
    <Button
      v-show="canvasStore.nodeSelected || canvasStore.groupSelected"
      severity="secondary"
      text
      @click="() => (showColorPicker = !showColorPicker)"
    >
      <template #icon>
        <div class="flex items-center gap-1">
          <i class="pi pi-circle-fill" :style="{ color: currentColor ?? '' }" />
          <i class="pi pi-chevron-down" :style="{ fontSize: '0.5rem' }" />
        </div>
      </template>
    </Button>
    <div
      v-if="showColorPicker"
      class="color-picker-container absolute -top-10 left-1/2"
    >
      <SelectButton
        :model-value="selectedColorOption"
        :options="colorOptions"
        option-label="name"
        data-key="value"
        @update:model-value="applyColor"
      >
        <template #option="{ option }">
          <i
            v-tooltip.top="option.localizedName"
            class="pi pi-circle-fill"
            :style="{
              color: isLightTheme ? option.value.light : option.value.dark
            }"
            :data-testid="option.name"
          />
        </template>
      </SelectButton>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { ColorOption as CanvasColorOption } from '@comfyorg/litegraph'
import { LGraphCanvas, LiteGraph, isColorable } from '@comfyorg/litegraph'
import Button from 'primevue/button'
import SelectButton from 'primevue/selectbutton'
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'

import { useCanvasStore } from '@/stores/graphStore'
import { useWorkflowStore } from '@/stores/workflowStore'
import { useColorPaletteStore } from '@/stores/workspace/colorPaletteStore'
import { adjustColor } from '@/utils/colorUtil'
import { getItemsColorOption } from '@/utils/litegraphUtil'

const { t } = useI18n()
const canvasStore = useCanvasStore()
const colorPaletteStore = useColorPaletteStore()
const workflowStore = useWorkflowStore()
const isLightTheme = computed(
  () => colorPaletteStore.completedActivePalette.light_theme
)
const toLightThemeColor = (color: string) =>
  adjustColor(color, { lightness: 0.5 })

const showColorPicker = ref(false)

type ColorOption = {
  name: string
  localizedName: string
  value: {
    dark: string
    light: string
  }
}

const NO_COLOR_OPTION: ColorOption = {
  name: 'noColor',
  localizedName: t('color.noColor'),
  value: {
    dark: LiteGraph.NODE_DEFAULT_BGCOLOR,
    light: toLightThemeColor(LiteGraph.NODE_DEFAULT_BGCOLOR)
  }
}
const colorOptions: ColorOption[] = [
  NO_COLOR_OPTION,
  ...Object.entries(LGraphCanvas.node_colors).map(([name, color]) => ({
    name,
    localizedName: t(`color.${name}`),
    value: {
      dark: color.bgcolor,
      light: toLightThemeColor(color.bgcolor)
    }
  }))
]

const selectedColorOption = ref<ColorOption | null>(null)
const applyColor = (colorOption: ColorOption | null) => {
  const colorName = colorOption?.name ?? NO_COLOR_OPTION.name
  const canvasColorOption =
    colorName === NO_COLOR_OPTION.name
      ? null
      : LGraphCanvas.node_colors[colorName]

  for (const item of canvasStore.selectedItems) {
    if (isColorable(item)) {
      item.setColorOption(canvasColorOption)
    }
  }

  canvasStore.canvas?.setDirty(true, true)
  currentColorOption.value = canvasColorOption
  showColorPicker.value = false
  workflowStore.activeWorkflow?.changeTracker.checkState()
}

const currentColorOption = ref<CanvasColorOption | null>(null)
const currentColor = computed(() =>
  currentColorOption.value
    ? isLightTheme.value
      ? toLightThemeColor(currentColorOption.value?.bgcolor)
      : currentColorOption.value?.bgcolor
    : null
)

watch(
  () => canvasStore.selectedItems,
  (newSelectedItems) => {
    showColorPicker.value = false
    selectedColorOption.value = null
    currentColorOption.value = getItemsColorOption(newSelectedItems)
  }
)
</script>

<style scoped>
.color-picker-container {
  transform: translateX(-50%);
}

:deep(.p-togglebutton) {
  @apply py-2 px-1;
}
</style>
