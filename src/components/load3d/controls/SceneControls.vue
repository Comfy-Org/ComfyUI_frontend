<template>
  <div class="flex flex-col">
    <Button
      class="p-button-rounded p-button-text"
      :class="{ 'p-button-outlined': showGrid }"
      @click="toggleGrid"
    >
      <i
        v-tooltip.right="{ value: $t('load3d.showGrid'), showDelay: 300 }"
        class="pi pi-table text-lg text-white"
      />
    </Button>

    <div v-if="!hasBackgroundImage">
      <Button class="p-button-rounded p-button-text" @click="openColorPicker">
        <i
          v-tooltip.right="{
            value: $t('load3d.backgroundColor'),
            showDelay: 300
          }"
          class="pi pi-palette text-lg text-white"
        />
        <input
          ref="colorPickerRef"
          type="color"
          :value="backgroundColor"
          class="pointer-events-none absolute m-0 h-0 w-0 p-0 opacity-0"
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
            value: $t('load3d.uploadBackgroundImage'),
            showDelay: 300
          }"
          class="pi pi-image text-lg text-white"
        />
        <input
          ref="imagePickerRef"
          type="file"
          accept="image/*"
          class="pointer-events-none absolute m-0 h-0 w-0 p-0 opacity-0"
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
            value: $t('load3d.removeBackgroundImage'),
            showDelay: 300
          }"
          class="pi pi-times text-lg text-white"
        />
      </Button>
    </div>
  </div>
</template>

<script setup lang="ts">
import Button from 'primevue/button'
import { computed, ref } from 'vue'

const emit = defineEmits<{
  (e: 'updateBackgroundImage', file: File | null): void
}>()

const showGrid = defineModel<boolean>('showGrid')
const backgroundColor = defineModel<string>('backgroundColor')
const backgroundImage = defineModel<string>('backgroundImage')
const hasBackgroundImage = computed(
  () => backgroundImage.value && backgroundImage.value !== ''
)

const colorPickerRef = ref<HTMLInputElement | null>(null)
const imagePickerRef = ref<HTMLInputElement | null>(null)

const toggleGrid = () => {
  showGrid.value = !showGrid.value
}

const updateBackgroundColor = (color: string) => {
  backgroundColor.value = color
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
