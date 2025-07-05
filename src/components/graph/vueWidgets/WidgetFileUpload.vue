<template>
  <div class="flex flex-col gap-1">
    <label v-if="widget.name" class="text-sm opacity-80">{{
      widget.name
    }}</label>
    <FileUpload
      v-bind="filteredProps"
      :disabled="readonly"
      @upload="handleUpload"
      @select="handleSelect"
      @remove="handleRemove"
      @clear="handleClear"
      @error="handleError"
    />
  </div>
</template>

<script setup lang="ts">
import FileUpload from 'primevue/fileupload'
import { computed } from 'vue'

import type { SimplifiedWidget } from '@/types/simplifiedWidget'
import {
  STANDARD_EXCLUDED_PROPS,
  filterWidgetProps
} from '@/utils/widgetPropFilter'

// FileUpload doesn't have a traditional v-model, it handles files through events
const props = defineProps<{
  widget: SimplifiedWidget<File[] | null>
  readonly?: boolean
}>()

const filteredProps = computed(() =>
  filterWidgetProps(props.widget.options, STANDARD_EXCLUDED_PROPS)
)

const handleUpload = (event: any) => {
  if (!props.readonly && props.widget.callback) {
    props.widget.callback(event.files)
  }
}

const handleSelect = (event: any) => {
  if (!props.readonly && props.widget.callback) {
    props.widget.callback(event.files)
  }
}

const handleRemove = (event: any) => {
  if (!props.readonly && props.widget.callback) {
    props.widget.callback(event.files)
  }
}

const handleClear = () => {
  if (!props.readonly && props.widget.callback) {
    props.widget.callback([])
  }
}

const handleError = (event: any) => {
  // Could be extended to handle error reporting
  console.warn('File upload error:', event)
}
</script>
