<template>
  <div class="flex flex-col">
    <Button
      class="p-button-rounded p-button-text"
      :class="{ 'p-button-outlined': showGrid }"
      @click="toggleGrid"
    >
      <i
        v-tooltip.right="{ value: t('load3d.showGrid'), showDelay: 300 }"
        class="pi pi-table text-white text-lg"
      />
    </Button>

    <div v-if="!hasBackgroundImage">
      <Button class="p-button-rounded p-button-text" @click="openColorPicker">
        <i
          v-tooltip.right="{
            value: t('load3d.backgroundColor'),
            showDelay: 300
          }"
          class="pi pi-palette text-white text-lg"
        />
        <input
          ref="colorPickerRef"
          type="color"
          :value="backgroundColor"
          class="absolute opacity-0 w-0 h-0 p-0 m-0 pointer-events-none"
          @input="
            updateBackgroundColor(($event.target as HTMLInputElement).value)
          "
        />
      </Button>
    </div>

    <div v-if="!hasBackgroundImage">
      <Button class="p-button-rounded p-button-text" @click="openImagePicker">
        <i
          v-tooltip.right="{
            value: t('load3d.uploadBackgroundImage'),
            showDelay: 300
          }"
          class="pi pi-image text-white text-lg"
        />
        <input
          ref="imagePickerRef"
          type="file"
          accept="image/*"
          class="absolute opacity-0 w-0 h-0 p-0 m-0 pointer-events-none"
          @change="uploadBackgroundImage"
        />
      </Button>
    </div>

    <div v-if="hasBackgroundImage">
      <Button
        class="p-button-rounded p-button-text"
        @click="removeBackgroundImage"
      >
        <i
          v-tooltip.right="{
            value: t('load3d.removeBackgroundImage'),
            showDelay: 300
          }"
          class="pi pi-times text-white text-lg"
        />
      </Button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { Tooltip } from 'primevue'
import Button from 'primevue/button'
import { ref, watch } from 'vue'

import { t } from '@/i18n'

const vTooltip = Tooltip

const props = defineProps<{
  backgroundColor: string
  showGrid: boolean
  hasBackgroundImage?: boolean
}>()

const emit = defineEmits<{
  (e: 'toggleGrid', value: boolean): void
  (e: 'updateBackgroundColor', color: string): void
  (e: 'updateBackgroundImage', file: File | null): void
}>()

const backgroundColor = ref(props.backgroundColor)
const showGrid = ref(props.showGrid)
const hasBackgroundImage = ref(props.hasBackgroundImage)
const colorPickerRef = ref<HTMLInputElement | null>(null)
const imagePickerRef = ref<HTMLInputElement | null>(null)

watch(
  () => props.backgroundColor,
  (newValue) => {
    backgroundColor.value = newValue
  }
)

watch(
  () => props.showGrid,
  (newValue) => {
    showGrid.value = newValue
  }
)

watch(
  () => props.hasBackgroundImage,
  (newValue) => {
    hasBackgroundImage.value = newValue
  }
)

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

const openImagePicker = () => {
  imagePickerRef.value?.click()
}

const uploadBackgroundImage = (event: Event) => {
  const input = event.target as HTMLInputElement

  if (input.files && input.files[0]) {
    emit('updateBackgroundImage', input.files[0])
  }
}

const removeBackgroundImage = () => {
  emit('updateBackgroundImage', null)
}
</script>
