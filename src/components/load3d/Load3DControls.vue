<template>
  <div class="view-controls">
    <Button class="p-button-rounded p-button-text" @click="toggleCamera">
      <i class="pi pi-camera"></i>
    </Button>

    <Button
      class="p-button-rounded p-button-text"
      :class="{ 'p-button-outlined': showGrid }"
      @click="toggleGrid"
    >
      <i class="pi pi-table"></i>
    </Button>

    <Button class="p-button-rounded p-button-text" @click="openColorPicker">
      <i class="pi pi-palette"></i>
      <input
        type="color"
        ref="colorPickerRef"
        :value="backgroundColor"
        @input="
          updateBackgroundColor(($event.target as HTMLInputElement).value)
        "
        class="color-input"
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
</script>

<style scoped>
.view-controls {
  position: absolute;
  top: 8px;
  left: 8px;
  display: flex;
  flex-direction: column;
  gap: 8px;
  pointer-events: auto;
  z-index: 2;
}

.pi {
  color: white;
  font-size: 1.2rem;
}

.color-input {
  position: absolute;
  opacity: 0;
  width: 0;
  height: 0;
  padding: 0;
  margin: 0;
  pointer-events: none;
}
</style>
