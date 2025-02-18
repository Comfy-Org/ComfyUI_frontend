<template>
  <div class="relative">
    <Button
      severity="secondary"
      text
      icon="pi pi-circle-fill"
      @click="() => (showColorPicker = !showColorPicker)"
    />
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
import { LGraphCanvas } from '@comfyorg/litegraph'
import Button from 'primevue/button'
import { ref, watch } from 'vue'

import ColorCustomizationSelector from '@/components/common/ColorCustomizationSelector.vue'
import { useCanvasStore } from '@/stores/graphStore'
import { setItemColor } from '@/utils/litegraphUtil'

const NO_COLOR_OPTION = { name: 'No Color', value: 'No Color' }

const showColorPicker = ref(false)
const color = ref(NO_COLOR_OPTION.value)

const colorOptions = ref<{ name: string; value: string }[]>([
  NO_COLOR_OPTION,
  ...Object.entries(LGraphCanvas.node_colors).map(([name, color]) => ({
    name,
    value: color.bgcolor
  }))
])

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
