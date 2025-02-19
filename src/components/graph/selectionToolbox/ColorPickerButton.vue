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
      <SelectButton
        v-model="selectedColorOption"
        :options="colorOptions"
        optionLabel="name"
        dataKey="value"
      >
        <template #option="{ option }">
          <i
            class="pi pi-circle-fill"
            :style="{
              color: isLightTheme ? option.value.light : option.value.dark
            }"
          />
        </template>
      </SelectButton>
    </div>
  </div>
</template>

<script setup lang="ts">
import {
  LGraphCanvas,
  LGraphGroup,
  LGraphNode,
  LiteGraph
} from '@comfyorg/litegraph'
import Button from 'primevue/button'
import SelectButton from 'primevue/selectbutton'
import { computed, ref, watch } from 'vue'

import { useCanvasStore } from '@/stores/graphStore'
import { useColorPaletteStore } from '@/stores/workspace/colorPaletteStore'
import { adjustColor } from '@/utils/colorUtil'

const canvasStore = useCanvasStore()
const colorPaletteStore = useColorPaletteStore()
const isLightTheme = computed(
  () => colorPaletteStore.completedActivePalette.light_theme
)

const showColorPicker = ref(false)

type ColorOption = {
  name: string
  value: {
    dark: string
    light: string
  }
}

const NO_COLOR_OPTION: ColorOption = {
  name: 'No Color',
  value: {
    dark: LiteGraph.NODE_DEFAULT_BGCOLOR,
    light: adjustColor(LiteGraph.NODE_DEFAULT_BGCOLOR, { lightness: 0.5 })
  }
}
const colorOptions: ColorOption[] = [
  NO_COLOR_OPTION,
  ...Object.entries(LGraphCanvas.node_colors).map(([name, color]) => ({
    name,
    value: {
      dark: color.bgcolor,
      light: adjustColor(color.bgcolor, { lightness: 0.5 })
    }
  }))
]

const selectedColorOption = ref<ColorOption | null>(null)
watch(selectedColorOption, (colorOption) => {
  applyColor(colorOption?.name ?? NO_COLOR_OPTION.name)
  showColorPicker.value = false
})

const applyColor = (colorName: string) => {
  const colorOption =
    colorName === NO_COLOR_OPTION.name
      ? null
      : LGraphCanvas.node_colors[colorName]

  for (const item of canvasStore.selectedItems) {
    if (item instanceof LGraphNode || item instanceof LGraphGroup) {
      item.setColorOption(colorOption)
    }
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
