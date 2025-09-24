<template>
  <WidgetSelectDropdown
    v-if="isDropdownUIWidget"
    :file-type="fileType"
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

import type { SimplifiedWidget } from '@/types/simplifiedWidget'

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

const isImageWidget = computed(() =>
  hasFilesWithExtensions(
    props.widget.options?.values || [],
    /\.(jpg|jpeg|png|gif|webp|svg|bmp|tiff|ico)$/i
  )
)

const isVideoWidget = computed(() =>
  hasFilesWithExtensions(
    props.widget.options?.values || [],
    /\.(mp4|webm|ogg|mov)$/i
  )
)

const isAudioWidget = computed(() =>
  hasFilesWithExtensions(
    props.widget.options?.values || [],
    /\.(mp3|wav|ogg|flac|aac|m4a)$/i
  )
)

const isModelWidget = computed(() =>
  hasFilesWithExtensions(
    props.widget.options?.values || [],
    /\.(safetensors)$/i
  )
)

const isDropdownUIWidget = computed(
  () =>
    isImageWidget.value ||
    isVideoWidget.value ||
    isAudioWidget.value ||
    isModelWidget.value
)

const fileType = computed(() => {
  if (isImageWidget.value) return 'image'
  if (isVideoWidget.value) return 'video'
  if (isAudioWidget.value) return 'audio'
  if (isModelWidget.value) return 'model'
  return 'unknown'
})

function hasFilesWithExtensions(
  values: any[],
  extensionPattern: RegExp
): boolean {
  if (!Array.isArray(values) || values.length === 0) {
    return false
  }

  return values.some((value) => {
    if (typeof value !== 'string') return false
    return extensionPattern.test(value)
  })
}
</script>
