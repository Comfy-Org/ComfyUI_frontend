<template>
  <div class="relative">
    <Button
      severity="secondary"
      text
      icon="pi pi-circle-fill"
      @click="() => (showColorPicker = true)"
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
import { ref } from 'vue'

import ColorCustomizationSelector from '@/components/common/ColorCustomizationSelector.vue'

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
</script>

<style scoped>
.color-picker-container {
  transform: translateX(-50%);
}

:deep(.p-togglebutton) {
  @apply p-2;
}
</style>
