<template>
  <!-- Replace entire widget with image preview when image is loaded -->
  <!-- Edge-to-edge: -mx-2 removes the parent's p-2 (8px) padding on each side -->
  <div
    v-if="hasImageFile"
    class="relative -mx-2"
    style="width: calc(100% + 1rem)"
  >
    <!-- Select section above image -->
    <div class="mb-2 flex items-center justify-between gap-4 px-2">
      <label
        v-if="widget.name"
        class="text-secondary min-w-[4em] truncate text-xs"
        >{{ widget.name }}</label
      >
      <!-- Group select and folder button together on the right -->
      <div class="flex items-center gap-1">
        <!-- TODO: finish once we finish value bindings with Litegraph -->
        <Select
          :model-value="selectedFile?.name"
          :options="[selectedFile?.name || '']"
          :disabled="true"
          :aria-label="`${$t('g.selectedFile')}: ${selectedFile?.name || $t('g.none')}`"
          v-bind="transformCompatProps"
          class="max-w-[20em] min-w-[8em] text-xs"
          size="small"
          :pt="{
            option: 'text-xs',
            dropdownIcon: 'text-button-icon'
          }"
        />
        <Button
          icon="pi pi-folder"
          size="small"
          class="!h-8 !w-8"
          @click="triggerFileInput"
        />
      </div>
    </div>

    <!-- Image preview -->
    <!-- TODO: change hardcoded colors when design system incorporated -->
    <div class="group relative">
      <img :src="imageUrl" :alt="selectedFile?.name" class="h-auto w-full" />
      <!-- Darkening overlay on hover -->
      <div
        class="bg-opacity-0 group-hover:bg-opacity-20 pointer-events-none absolute inset-0 bg-black transition-all duration-200"
      />
      <!-- Control buttons in top right on hover -->
      <div
        class="absolute top-2 right-2 flex gap-1 opacity-0 transition-opacity duration-200 group-hover:opacity-100"
      >
        <!-- Edit button -->
        <button
          :aria-label="$t('g.editImage')"
          class="flex h-6 w-6 items-center justify-center rounded border-none transition-all duration-150 focus:outline-none"
          style="background-color: #262729"
          @click="handleEdit"
        >
          <i class="pi pi-pencil text-xs text-white"></i>
        </button>
        <!-- Delete button -->
        <button
          :aria-label="$t('g.deleteImage')"
          class="flex h-6 w-6 items-center justify-center rounded border-none transition-all duration-150 focus:outline-none"
          style="background-color: #262729"
          @click="clearFile"
        >
          <i class="pi pi-times text-xs text-white"></i>
        </button>
      </div>
    </div>
  </div>

  <!-- Audio preview when audio file is loaded -->
  <div
    v-else-if="hasAudioFile"
    class="relative -mx-2"
    style="width: calc(100% + 1rem)"
  >
    <!-- Select section above audio player -->
    <div class="mb-2 flex items-center justify-between gap-4 px-2">
      <label
        v-if="widget.name"
        class="text-secondary min-w-[4em] truncate text-xs"
        >{{ widget.name }}</label
      >
      <!-- Group select and folder button together on the right -->
      <div class="flex items-center gap-1">
        <Select
          :model-value="selectedFile?.name"
          :options="[selectedFile?.name || '']"
          :disabled="true"
          :aria-label="`${$t('g.selectedFile')}: ${selectedFile?.name || $t('g.none')}`"
          v-bind="transformCompatProps"
          class="max-w-[20em] min-w-[8em] text-xs"
          size="small"
          :pt="{
            option: 'text-xs',
            dropdownIcon: 'text-button-icon'
          }"
        />
        <Button
          icon="pi pi-folder"
          size="small"
          class="!h-8 !w-8"
          @click="triggerFileInput"
        />
      </div>
    </div>

    <!-- Audio player -->
    <div class="group relative px-2">
      <div
        class="flex items-center gap-4 rounded-lg bg-charcoal-800 p-4"
        style="border: 1px solid #262729"
      >
        <!-- Audio icon -->
        <div class="flex-shrink-0">
          <i class="pi pi-volume-up text-2xl opacity-60"></i>
        </div>

        <!-- File info and controls -->
        <div class="flex-1">
          <div class="mb-1 text-sm font-medium">{{ selectedFile?.name }}</div>
          <div class="text-xs opacity-60">
            {{
              selectedFile ? (selectedFile.size / 1024).toFixed(1) + ' KB' : ''
            }}
          </div>
        </div>

        <!-- Control buttons -->
        <div class="flex gap-1">
          <!-- Delete button -->
          <button
            :aria-label="$t('g.deleteAudioFile')"
            class="flex h-8 w-8 items-center justify-center rounded border-none transition-all duration-150 hover:bg-charcoal-600 focus:outline-none"
            @click="clearFile"
          >
            <i class="pi pi-times text-sm text-white"></i>
          </button>
        </div>
      </div>
    </div>
  </div>

  <!-- Show normal file upload UI when no image or audio is loaded -->
  <div
    v-else
    class="flex w-full flex-col gap-1 rounded-lg border border-solid p-1"
    :style="{ borderColor: '#262729' }"
  >
    <div
      class="rounded-md border border-dashed p-1 transition-colors duration-200 hover:border-slate-300"
      :style="{ borderColor: '#262729' }"
    >
      <div class="flex w-full flex-col items-center gap-2 py-4">
        <span class="text-xs opacity-60"> {{ $t('Drop your file or') }} </span>
        <div>
          <Button
            label="Browse Files"
            size="small"
            severity="secondary"
            class="text-xs"
            @click="triggerFileInput"
          />
        </div>
      </div>
    </div>
  </div>
  <!-- Hidden file input always available for both states -->
  <input
    ref="fileInputRef"
    type="file"
    class="hidden"
    :accept="widget.options?.accept"
    :aria-label="`${$t('g.upload')} ${widget.name || $t('g.file')}`"
    :multiple="false"
    @change="handleFileChange"
  />
</template>

<script setup lang="ts">
import Button from 'primevue/button'
import Select from 'primevue/select'
import { computed, onUnmounted, ref, watch } from 'vue'

import { useWidgetValue } from '@/composables/graph/useWidgetValue'
import { useTransformCompatOverlayProps } from '@/composables/useTransformCompatOverlayProps'
import type { SimplifiedWidget } from '@/types/simplifiedWidget'

const { widget, modelValue } = defineProps<{
  widget: SimplifiedWidget<File[] | null>
  modelValue: File[] | null
}>()

const emit = defineEmits<{
  'update:modelValue': [value: File[] | null]
}>()

const { localValue, onChange } = useWidgetValue({
  widget,
  modelValue,
  defaultValue: null,
  emit
})

// Transform compatibility props for overlay positioning
const transformCompatProps = useTransformCompatOverlayProps()

const fileInputRef = ref<HTMLInputElement | null>(null)

// Since we only support single file, get the first file
const selectedFile = computed(() => {
  const files = localValue.value || []
  return files.length > 0 ? files[0] : null
})

// Quick file type detection for testing
const detectFileType = (file: File) => {
  const type = file.type?.toLowerCase() || ''
  const name = file.name?.toLowerCase() || ''

  if (
    type.startsWith('image/') ||
    name.match(/\.(jpg|jpeg|png|gif|webp|svg)$/)
  ) {
    return 'image'
  }
  if (type.startsWith('video/') || name.match(/\.(mp4|webm|ogg|mov)$/)) {
    return 'video'
  }
  if (type.startsWith('audio/') || name.match(/\.(mp3|wav|ogg|flac)$/)) {
    return 'audio'
  }
  if (type === 'application/pdf' || name.endsWith('.pdf')) {
    return 'pdf'
  }
  if (type.includes('zip') || name.match(/\.(zip|rar|7z|tar|gz)$/)) {
    return 'archive'
  }
  return 'file'
}

// Check if we have an image file
const hasImageFile = computed(() => {
  return selectedFile.value && detectFileType(selectedFile.value) === 'image'
})

// Check if we have an audio file
const hasAudioFile = computed(() => {
  return selectedFile.value && detectFileType(selectedFile.value) === 'audio'
})

// Get image URL for preview
const imageUrl = computed(() => {
  if (hasImageFile.value && selectedFile.value) {
    return URL.createObjectURL(selectedFile.value)
  }
  return ''
})

// // Get audio URL for playback
// const audioUrl = computed(() => {
//   if (hasAudioFile.value && selectedFile.value) {
//     return URL.createObjectURL(selectedFile.value)
//   }
//   return ''
// })

// Clean up image URL when file changes
watch(imageUrl, (newUrl, oldUrl) => {
  if (oldUrl && oldUrl !== newUrl) {
    URL.revokeObjectURL(oldUrl)
  }
})

const triggerFileInput = () => {
  fileInputRef.value?.click()
}

const handleFileChange = (event: Event) => {
  const target = event.target as HTMLInputElement
  if (target.files && target.files.length > 0) {
    // Since we only support single file, take the first one
    const file = target.files[0]

    // Use the composable's onChange handler with an array
    onChange([file])

    // Reset input to allow selecting same file again
    target.value = ''
  }
}

const clearFile = () => {
  // Clear the file
  onChange(null)

  // Reset file input
  if (fileInputRef.value) {
    fileInputRef.value.value = ''
  }
}

const handleEdit = () => {
  // TODO: hook up with maskeditor
}

// Clear file input when value is cleared externally
watch(localValue, (newValue) => {
  if (!newValue || newValue.length === 0) {
    if (fileInputRef.value) {
      fileInputRef.value.value = ''
    }
  }
})

// Clean up image URL on unmount
onUnmounted(() => {
  if (imageUrl.value) {
    URL.revokeObjectURL(imageUrl.value)
  }
})
</script>
