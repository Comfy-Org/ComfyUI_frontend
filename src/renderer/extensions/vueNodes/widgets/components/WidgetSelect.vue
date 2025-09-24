<template>
  <WidgetSelectDropdown
    v-if="isMediaWidget"
    v-bind="props"
    @update:model-value="handleUpdateModelValue"
  />
  <WidgetSelectDefault
    v-else
    v-bind="props"
    @update:model-value="handleUpdateModelValue"
  />
</template>

<script setup lang="ts">
import { computed } from 'vue'

import type { SimplifiedWidget, WidgetValue } from '@/types/simplifiedWidget'

import WidgetSelectDefault from './WidgetSelectDefault.vue'
import WidgetSelectDropdown from './WidgetSelectDropdown.vue'

const props = defineProps<{
  widget: SimplifiedWidget<string | number | undefined>
  modelValue: string | number | undefined
  readonly?: boolean
}>()

const emit = defineEmits<{
  'update:modelValue': [value: string | number | undefined]
}>()

function handleUpdateModelValue(value: string | number | undefined) {
  emit('update:modelValue', value)
}

const isMediaWidget = computed(() =>
  shouldUseMediaDropdown(props.widget as any)
)

function shouldUseMediaDropdown(
  widget: SimplifiedWidget<WidgetValue>
): boolean {
  // Method 1: Check for image_upload, video_upload, or audio_upload flags
  const options = widget.options
  if (
    options?.image_upload ||
    options?.video_upload ||
    options?.animated_image_upload
  ) {
    return true
  }

  // Method 2: Check if values contain media file extensions
  const values = options?.values || []
  if (Array.isArray(values) && values.length > 0) {
    const hasMediaFiles = values.some((value) => {
      if (typeof value !== 'string') return false

      // Check for common media file extensions
      const mediaExtensions =
        /\.(jpg|jpeg|png|gif|webp|svg|bmp|tiff|ico|mp4|webm|ogg|mov|avi|mkv|mp3|wav|flac|ogg|aac|m4a)$/i
      return mediaExtensions.test(value)
    })

    if (hasMediaFiles) return true
  }

  // Method 3: Future - check for Asset input type (when backend supports it)
  // This is placeholder for future implementation
  // if (widget.inputType === 'Asset') return true

  return false
}
</script>
