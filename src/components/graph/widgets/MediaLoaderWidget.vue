<template>
  <div class="media-loader-widget w-full px-2 max-h-44">
    <div
      class="upload-area border-2 border-dashed border-surface-300 dark-theme:border-surface-600 rounded-lg p-6 text-center bg-surface-50 dark-theme:bg-surface-800 hover:bg-surface-100 dark-theme:hover:bg-surface-700 transition-colors cursor-pointer"
      :class="{
        'border-primary-500 bg-primary-50 dark-theme:bg-primary-950': isDragOver
      }"
      @click="triggerFileUpload"
      @dragover.prevent="onDragOver"
      @dragleave.prevent="onDragLeave"
      @drop.prevent="onDrop"
    >
      <div class="flex flex-col items-center gap-2">
        <i
          class="pi pi-cloud-upload text-2xl text-surface-500 dark-theme:text-surface-400"
        ></i>
        <div class="text-sm text-surface-600 dark-theme:text-surface-300">
          <span>Drop your file here or </span>
          <span
            class="text-primary-600 dark-theme:text-primary-400 hover:text-primary-700 dark-theme:hover:text-primary-300 underline cursor-pointer"
            @click.stop="triggerFileUpload"
          >
            browse files
          </span>
        </div>
        <div
          v-if="accept"
          class="text-xs text-surface-500 dark-theme:text-surface-400"
        >
          Accepted formats: {{ formatAcceptTypes }}
        </div>
      </div>
    </div>

    <!-- Hidden file input -->
    <input
      ref="fileInput"
      type="file"
      :accept="accept"
      multiple
      class="hidden"
      @change="onFileSelect"
    />
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'

import type { ComponentWidget } from '@/scripts/domWidget'

// Props and model
const modelValue = defineModel<string[]>({ required: true, default: () => [] })
const { widget, accept } = defineProps<{
  widget: ComponentWidget<string[]>
  accept?: string
}>()

// Reactive state
const fileInput = ref<HTMLInputElement>()
const isDragOver = ref(false)

// Computed properties
const formatAcceptTypes = computed(() => {
  if (!accept) return ''
  return accept
    .split(',')
    .map((type) =>
      type
        .trim()
        .replace('image/', '')
        .replace('video/', '')
        .replace('audio/', '')
    )
    .join(', ')
})

// Methods
const triggerFileUpload = () => {
  fileInput.value?.click()
}

const onFileSelect = (event: Event) => {
  const target = event.target as HTMLInputElement
  if (target.files) {
    handleFiles(Array.from(target.files))
  }
}

const onDragOver = (event: DragEvent) => {
  event.preventDefault()
  isDragOver.value = true
}

const onDragLeave = (event: DragEvent) => {
  event.preventDefault()
  isDragOver.value = false
}

const onDrop = (event: DragEvent) => {
  event.preventDefault()
  isDragOver.value = false

  if (event.dataTransfer?.files) {
    handleFiles(Array.from(event.dataTransfer.files))
  }
}

const handleFiles = (files: File[]) => {
  // Filter files based on accept prop if provided
  let validFiles = files
  if (accept) {
    const acceptTypes = accept
      .split(',')
      .map((type) => type.trim().toLowerCase())
    validFiles = files.filter((file) => {
      return acceptTypes.some((acceptType) => {
        if (acceptType.includes('*')) {
          // Handle wildcard types like "image/*"
          const baseType = acceptType.split('/')[0]
          return file.type.startsWith(baseType + '/')
        }
        return file.type.toLowerCase() === acceptType
      })
    })
  }

  if (validFiles.length > 0) {
    // Emit files to parent component for handling upload
    const fileNames = validFiles.map((file) => file.name)
    modelValue.value = fileNames

    // Trigger the widget's upload handler if available
    if ((widget.options as any)?.onFilesSelected) {
      ;(widget.options as any).onFilesSelected(validFiles)
    }
  }
}
</script>

<style scoped>
.upload-area {
  min-height: 80px;
  transition: all 0.2s ease;
}

.upload-area:hover {
  border-color: var(--p-primary-500);
}
</style>
