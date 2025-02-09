<template>
  <div
    class="absolute top-2 left-2 flex flex-col gap-2 pointer-events-auto z-20"
  >
    <Button class="p-button-rounded p-button-text" @click="toggleCamera">
      <i class="pi pi-camera text-white text-lg"></i>
    </Button>

    <Button
      class="p-button-rounded p-button-text"
      :class="{ 'p-button-outlined': showGrid }"
      @click="toggleGrid"
    >
      <i class="pi pi-table text-white text-lg"></i>
    </Button>

    <Button class="p-button-rounded p-button-text" @click="openColorPicker">
      <i class="pi pi-palette text-white text-lg"></i>
      <input
        type="color"
        ref="colorPickerRef"
        :value="backgroundColor"
        @input="
          updateBackgroundColor(($event.target as HTMLInputElement).value)
        "
        class="absolute opacity-0 w-0 h-0 p-0 m-0 pointer-events-none"
      />
    </Button>
  </div>
</template>

<script setup lang="ts">
import Button from 'primevue/button'
import { ref } from 'vue'

const props = defineProps<{
  backgroundColor: string
  showGrid: boolean
}>()

const emit = defineEmits<{
  (e: 'toggleCamera'): void
  (e: 'toggleGrid', value: boolean): void
  (e: 'updateBackgroundColor', color: string): void
}>()

const backgroundColor = ref(props.backgroundColor)
const showGrid = ref(props.showGrid)
const colorPickerRef = ref<HTMLInputElement | null>(null)

const toggleCamera = () => {
  emit('toggleCamera')
}

const toggleGrid = () => {
  showGrid.value = !showGrid.value
  emit('toggleGrid', showGrid.value)
}

const updateBackgroundColor = (color: string) => {
  emit('updateBackgroundColor', color)
}

const openColorPicker = () => {
  colorPickerRef.value?.click()
}

defineExpose({
  backgroundColor,
  showGrid
})
</script>
