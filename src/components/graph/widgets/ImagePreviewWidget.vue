<template>
  <div class="image-preview-widget relative w-full">
    <!-- Single image or grid view -->
    <div
      v-if="images.length > 0"
      class="relative rounded-lg overflow-hidden bg-gray-100 dark-theme:bg-gray-800"
      :style="{ minHeight: `${minHeight}px` }"
    >
      <!-- Single image view -->
      <div
        v-if="selectedImageIndex !== null && images[selectedImageIndex]"
        class="relative flex items-center justify-center w-full h-full"
      >
        <img
          :src="images[selectedImageIndex].src"
          :alt="`Preview ${selectedImageIndex + 1}`"
          class="max-w-full max-h-full object-contain"
          @error="handleImageError"
        />

        <!-- Action buttons overlay -->
        <div class="absolute top-2 right-2 flex gap-1">
          <Button
            v-if="images.length > 1"
            icon="pi pi-times"
            size="small"
            severity="secondary"
            class="w-8 h-8 rounded-lg bg-black/60 text-white border-none hover:bg-black/80"
            @click="showGrid"
          />
          <Button
            icon="pi pi-pencil"
            size="small"
            severity="secondary"
            class="w-8 h-8 rounded-lg bg-black/60 text-white border-none hover:bg-black/80"
            @click="handleEdit"
          />
          <Button
            icon="pi pi-sun"
            size="small"
            severity="secondary"
            class="w-8 h-8 rounded-lg bg-black/60 text-white border-none hover:bg-black/80"
            @click="handleBrightness"
          />
          <Button
            icon="pi pi-download"
            size="small"
            severity="secondary"
            class="w-8 h-8 rounded-lg bg-black/60 text-white border-none hover:bg-black/80"
            @click="handleSave"
          />
        </div>

        <!-- Navigation for multiple images -->
        <div
          v-if="images.length > 1"
          class="absolute bottom-2 right-2 bg-black/60 text-white px-2 py-1 rounded text-sm cursor-pointer hover:bg-black/80"
          @click="nextImage"
        >
          {{ selectedImageIndex + 1 }}/{{ images.length }}
        </div>
      </div>

      <!-- Grid view for multiple images -->
      <div
        v-else-if="allowBatch && images.length > 1"
        class="grid gap-1 p-2"
        :style="gridStyle"
      >
        <div
          v-for="(image, index) in images"
          :key="index"
          class="relative aspect-square bg-gray-200 dark-theme:bg-gray-700 rounded cursor-pointer overflow-hidden hover:ring-2 hover:ring-blue-500"
          @click="selectImage(index)"
        >
          <img
            :src="image.src"
            :alt="`Thumbnail ${index + 1}`"
            class="w-full h-full object-cover"
            @error="handleImageError"
          />
        </div>
      </div>

      <!-- Single image in grid mode -->
      <div v-else-if="images.length === 1" class="p-2">
        <div
          class="relative bg-gray-200 dark-theme:bg-gray-700 rounded cursor-pointer overflow-hidden"
          @click="selectImage(0)"
        >
          <img
            :src="images[0].src"
            :alt="'Preview'"
            class="w-full h-auto object-contain"
            @error="handleImageError"
          />
        </div>
      </div>
    </div>

    <!-- Empty state -->
    <div
      v-else
      class="flex items-center justify-center w-full bg-gray-100 dark-theme:bg-gray-800 rounded-lg"
      :style="{ minHeight: `${minHeight}px` }"
    >
      <div class="text-gray-500 text-sm">No images to preview</div>
    </div>
  </div>
</template>

<script setup lang="ts">
import Button from 'primevue/button'
import { computed, ref } from 'vue'

import type { ComponentWidget } from '@/scripts/domWidget'

interface ImageData {
  src: string
  width?: number
  height?: number
}

const modelValue = defineModel<string | string[]>({ required: true })
const { widget } = defineProps<{
  widget: ComponentWidget<string | string[]>
}>()

// Widget configuration
const inputSpec = widget.inputSpec
const allowBatch = computed(() => Boolean(inputSpec.allow_batch))
const imageFolder = computed(() => inputSpec.image_folder || 'input')

// State
const selectedImageIndex = ref<number | null>(null)
const minHeight = 320

// Convert model value to image data
const images = computed<ImageData[]>(() => {
  const value = modelValue.value
  if (!value) return []

  const paths = Array.isArray(value) ? value : [value]
  return paths.map((path) => ({
    src: path.startsWith('http')
      ? path
      : `api/view?filename=${encodeURIComponent(path)}&type=${imageFolder.value}`, // TODO: add subfolder
    width: undefined,
    height: undefined
  }))
})

// Grid layout for batch images
const gridStyle = computed(() => {
  const count = images.value.length
  if (count <= 1) return {}

  const cols = Math.ceil(Math.sqrt(count))
  return {
    gridTemplateColumns: `repeat(${cols}, 1fr)`
  }
})

// Methods
const selectImage = (index: number) => {
  selectedImageIndex.value = index
}

const showGrid = () => {
  selectedImageIndex.value = null
}

const nextImage = () => {
  if (images.value.length === 0) return

  const current = selectedImageIndex.value ?? -1
  const next = (current + 1) % images.value.length
  selectedImageIndex.value = next
}

const handleImageError = (event: Event) => {
  const img = event.target as HTMLImageElement
  img.style.display = 'none'
  console.warn('Failed to load image:', img.src)
}

// Stub button handlers for now
const handleEdit = () => {
  console.log('Edit button clicked - functionality to be implemented')
}

const handleBrightness = () => {
  console.log('Brightness button clicked - functionality to be implemented')
}

const handleSave = () => {
  console.log('Save button clicked - functionality to be implemented')
}

// Initialize to show first image if available
if (images.value.length === 1) {
  selectedImageIndex.value = 0
}
</script>

<style scoped>
.image-preview-widget {
  /* Ensure proper dark theme styling */
}
</style>
