<template>
  <!-- Replace entire widget with image preview when image is loaded -->
  <!-- Edge-to-edge: -mx-2 removes the parent's p-2 (8px) padding on each side -->
  <div
    v-if="hasImageFile"
    class="relative -mx-2"
    style="width: calc(100% + 1rem)"
  >
    <!-- Select section above image -->
    <div class="flex items-center justify-between gap-4 mb-2 px-2">
      <label
        v-if="widget.name"
        class="text-xs opacity-80 min-w-[4em] truncate"
        >{{ widget.name }}</label
      >
      <!-- Group select and folder button together on the right -->
      <div class="flex items-center gap-1">
        <!-- TODO: finish once we finish value bindings with Litegraph -->
        <Select
          :model-value="selectedFile?.name"
          :options="[selectedFile?.name || '']"
          :disabled="true"
          class="min-w-[8em] max-w-[20em] text-xs"
          size="small"
          :pt="{
            option: 'text-xs'
          }"
        />
        <Button
          icon="pi pi-folder"
          size="small"
          class="!w-8 !h-8"
          :disabled="readonly"
          @click="triggerFileInput"
        />
      </div>
    </div>

    <!-- Image preview -->
    <!-- TODO: change hardcoded colors when design system incorporated -->
    <div class="relative group">
      <img :src="imageUrl" :alt="selectedFile?.name" class="w-full h-auto" />
      <!-- Darkening overlay on hover -->
      <div
        class="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-20 transition-all duration-200 pointer-events-none"
      />
      <!-- Control buttons in top right on hover -->
      <div
        v-if="!readonly"
        class="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity duration-200"
      >
        <!-- Edit button -->
        <button
          class="w-6 h-6 rounded flex items-center justify-center transition-all duration-150 focus:outline-none border-none"
          style="background-color: #262729"
          @click="handleEdit"
        >
          <i class="pi pi-pencil text-white text-xs"></i>
        </button>
        <!-- Delete button -->
        <button
          class="w-6 h-6 rounded flex items-center justify-center transition-all duration-150 focus:outline-none border-none"
          style="background-color: #262729"
          @click="clearFile"
        >
          <i class="pi pi-times text-white text-xs"></i>
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
    <div class="flex items-center justify-between gap-4 mb-2 px-2">
      <label
        v-if="widget.name"
        class="text-xs opacity-80 min-w-[4em] truncate"
        >{{ widget.name }}</label
      >
      <!-- Group select and folder button together on the right -->
      <div class="flex items-center gap-1">
        <Select
          :model-value="selectedFile?.name"
          :options="[selectedFile?.name || '']"
          :disabled="true"
          class="min-w-[8em] max-w-[20em] text-xs"
          size="small"
          :pt="{
            option: 'text-xs'
          }"
        />
        <Button
          icon="pi pi-folder"
          size="small"
          class="!w-8 !h-8"
          :disabled="readonly"
          @click="triggerFileInput"
        />
      </div>
    </div>

    <!-- Audio player -->
    <div class="relative group px-2">
      <div
        class="bg-[#1a1b1e] rounded-lg p-4 flex items-center gap-4"
        style="border: 1px solid #262729"
      >
        <!-- Audio icon -->
        <div class="flex-shrink-0">
          <i class="pi pi-volume-up text-2xl opacity-60"></i>
        </div>

        <!-- File info and controls -->
        <div class="flex-1">
          <div class="text-sm font-medium mb-1">{{ selectedFile?.name }}</div>
          <div class="text-xs opacity-60">
            {{
              selectedFile ? (selectedFile.size / 1024).toFixed(1) + ' KB' : ''
            }}
          </div>
        </div>

        <!-- Control buttons -->
        <div v-if="!readonly" class="flex gap-1">
          <!-- Delete button -->
          <button
            class="w-8 h-8 rounded flex items-center justify-center transition-all duration-150 focus:outline-none border-none hover:bg-[#262729]"
            @click="clearFile"
          >
            <i class="pi pi-times text-white text-sm"></i>
          </button>
        </div>
      </div>
    </div>
  </div>

  <!-- Show normal file upload UI when no image or audio is loaded -->
  <div
    v-else
    class="flex flex-col gap-1 w-full border border-solid p-1 rounded-lg"
    :style="{ borderColor: '#262729' }"
  >
    <div
      class="border border-dashed p-1 rounded-md transition-colors duration-200 hover:border-[#5B5E7D]"
      :style="{ borderColor: '#262729' }"
    >
      <div class="flex flex-col items-center gap-2 w-full py-4">
        <!-- Quick and dirty file type detection for testing -->
        <!-- eslint-disable-next-line @intlify/vue-i18n/no-raw-text -->
        <span class="text-xs opacity-60"> Drop your file or </span>
        <div>
          <Button
            label="Browse Files"
            size="small"
            class="text-xs"
            :disabled="readonly"
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
    :multiple="false"
    :disabled="readonly"
    @change="handleFileChange"
  />
</template>

<script setup lang="ts">
import Button from 'primevue/button'
import Select from 'primevue/select'
import { computed, onUnmounted, ref, watch } from 'vue'

// import { useI18n } from 'vue-i18n' // Commented out for testing

import { useWidgetValue } from '@/composables/graph/useWidgetValue'
import type { SimplifiedWidget } from '@/types/simplifiedWidget'

// const { t } = useI18n() // Commented out for testing

const props = defineProps<{
  widget: SimplifiedWidget<File[] | null>
  modelValue: File[] | null
  readonly?: boolean
}>()

const emit = defineEmits<{
  'update:modelValue': [value: File[] | null]
}>()

// Use the composable for consistent widget value handling
const { localValue, onChange } = useWidgetValue({
  widget: props.widget,
  modelValue: props.modelValue,
  defaultValue: null,
  emit
})

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
  if (!props.readonly && target.files && target.files.length > 0) {
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
