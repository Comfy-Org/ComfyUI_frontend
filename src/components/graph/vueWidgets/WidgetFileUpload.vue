<template>
  <div class="flex flex-col gap-1 w-full">
    <label v-if="widget.name" class="text-xs opacity-80">{{
      widget.name
    }}</label>
    <div class="flex flex-col items-center gap-2 w-full">
      <!-- TODO: Given file type from node definition, change text here and display differently. -->
      <span class="text-xs opacity-60">{{ t('g.dropYourFileOr') }}</span>
      <div class="w-full">
        <Button
          :label="getButtonLabel()"
          size="small"
          class="w-full text-xs"
          :disabled="readonly"
          @click="triggerFileInput"
        />
        <input
          ref="fileInputRef"
          type="file"
          class="hidden"
          :accept="widget.options?.accept"
          :multiple="widget.options?.multiple"
          :disabled="readonly"
          @change="handleFileChange"
        />
      </div>
      <!-- Display selected files -->
      <div v-if="selectedFiles.length > 0" class="w-full text-xs">
        <div
          v-for="(file, index) in selectedFiles"
          :key="index"
          class="flex items-center justify-between p-1"
        >
          <span class="truncate flex-1">{{ file.name }}</span>
          <Button
            v-if="!readonly"
            icon="pi pi-times"
            size="small"
            text
            severity="secondary"
            @click="removeFile(index)"
          />
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import Button from 'primevue/button'
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'

import { useWidgetValue } from '@/composables/graph/useWidgetValue'
import type { SimplifiedWidget } from '@/types/simplifiedWidget'

const { t } = useI18n()

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

// Use localValue from composable
const selectedFiles = computed(() => localValue.value || [])

const getButtonLabel = () => {
  if (selectedFiles.value.length > 0) {
    return `${selectedFiles.value.length} file(s) selected`
  }
  return props.widget.options?.chooseLabel || t('g.searchbox.browse')
}

const triggerFileInput = () => {
  fileInputRef.value?.click()
}

const handleFileChange = (event: Event) => {
  const target = event.target as HTMLInputElement
  if (!props.readonly && target.files) {
    // Convert FileList to array
    const files = Array.from(target.files)

    // Use the composable's onChange handler
    onChange(files)

    // Reset input to allow selecting same file again
    target.value = ''
  }
}

const removeFile = (index: number) => {
  const newFiles = [...selectedFiles.value]
  newFiles.splice(index, 1)

  const filesOrNull = newFiles.length > 0 ? newFiles : null

  // Use the composable's onChange handler
  onChange(filesOrNull)
}

// Clear file input when value is cleared externally
watch(localValue, (newValue) => {
  if (!newValue || newValue.length === 0) {
    if (fileInputRef.value) {
      fileInputRef.value.value = ''
    }
  }
})
</script>
