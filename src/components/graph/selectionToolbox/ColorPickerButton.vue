<template>
  <div class="relative">
    <Button
      severity="secondary"
      text
      @click="() => (showColorPicker = !showColorPicker)"
    >
      <template #icon>
        <div class="flex items-center gap-1">
          <i class="pi pi-circle-fill" />
          <i class="pi pi-chevron-down" :style="{ fontSize: '0.5rem' }" />
        </div>
      </template>
    </Button>
    <div
      v-if="showColorPicker"
      class="color-picker-container absolute -top-10 left-1/2"
    >
      <ColorCustomizationSelector
        :color-options="colorOptions"
        v-model="color"
        :allow-custom="false"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { LGraphCanvas, LiteGraph } from '@comfyorg/litegraph'
import Button from 'primevue/button'
import { computed, ref, watch } from 'vue'

import ColorCustomizationSelector from '@/components/common/ColorCustomizationSelector.vue'
import { useCanvasStore } from '@/stores/graphStore'
import { useColorPaletteStore } from '@/stores/workspace/colorPaletteStore'
import { adjustColor } from '@/utils/colorUtil'
import { setItemColor } from '@/utils/litegraphUtil'

const showColorPicker = ref(false)

const NO_COLOR_OPTION = {
  name: 'No Color',
  value: LiteGraph.NODE_DEFAULT_BGCOLOR
}
const darkThemeColorOptions = [
  NO_COLOR_OPTION,
  ...Object.entries(LGraphCanvas.node_colors).map(([name, color]) => ({
    name,
    value: color.bgcolor
  }))
]
const lightThemeColorOptions = darkThemeColorOptions.map((option) => ({
  ...option,
  value: adjustColor(option.value, { lightness: 0.5 })
}))

const colorPaletteStore = useColorPaletteStore()
const colorOptions = computed<{ name: string; value: string }[]>(() =>
  colorPaletteStore.completedActivePalette.light_theme
    ? lightThemeColorOptions
    : darkThemeColorOptions
)
const color = ref(colorOptions.value[0].value)
watch(colorOptions, (newOptions, oldOptions) => {
  const oldOption = oldOptions.find((option) => option.value === color.value)
  const newValue = newOptions.find((option) => option.name === oldOption?.name)
  if (newValue) {
    color.value = newValue.value
  }
})
watch(color, (colorValue) => {
  const option = colorOptions.value.find(
    (option) => option.value === colorValue
  )
  if (option) {
    applyColor(option.name)
  }
  showColorPicker.value = false
})

const canvasStore = useCanvasStore()
const applyColor = (colorName: string) => {
  const colorOption =
    colorName === NO_COLOR_OPTION.name
      ? null
      : LGraphCanvas.node_colors[colorName]

  for (const item of canvasStore.selectedItems) {
    setItemColor(item, colorOption)
  }

  canvasStore.canvas?.setDirty(true, true)
}
</script>

<style scoped>
.color-picker-container {
  transform: translateX(-50%);
}

:deep(.p-togglebutton) {
  @apply py-2 px-1;
}
</style>
