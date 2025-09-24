<template>
  <WidgetLayoutField :widget>
    <FormDropdown
      v-model:selected="selectedSet"
      :items="dropdownItems"
      :placeholder="mediaPlaceholder"
      :multiple="false"
      v-bind="combinedProps"
      class="w-full"
      @update:selected="updateSelectedItems"
    />
  </WidgetLayoutField>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'

import { useWidgetValue } from '@/composables/graph/useWidgetValue'
import { useTransformCompatOverlayProps } from '@/composables/useTransformCompatOverlayProps'
import type { SimplifiedWidget } from '@/types/simplifiedWidget'
import {
  PANEL_EXCLUDED_PROPS,
  filterWidgetProps
} from '@/utils/widgetPropFilter'

import FormDropdown from './form/dropdown/FormDropdown.vue'
import type { DropdownItem } from './form/dropdown/types'
import WidgetLayoutField from './layout/WidgetLayoutField.vue'

const props = defineProps<{
  widget: SimplifiedWidget<string | number | undefined>
  modelValue: string | number | undefined
  readonly?: boolean
}>()

const emit = defineEmits<{
  'update:modelValue': [value: string | number | undefined]
}>()

const { localValue, onChange } = useWidgetValue({
  widget: props.widget,
  modelValue: props.modelValue,
  defaultValue: props.widget.options?.values?.[0] || '',
  emit
})

const transformCompatProps = useTransformCompatOverlayProps()

const combinedProps = computed(() => ({
  ...filterWidgetProps(props.widget.options, PANEL_EXCLUDED_PROPS),
  ...transformCompatProps.value
}))

// Media dropdown specific logic
const selectedSet = ref<Set<number>>(new Set())
const dropdownItems = computed<DropdownItem[]>(() => {
  const values = props.widget.options?.values || []

  if (!Array.isArray(values)) {
    return []
  }

  return values.map((value: string, index: number) => ({
    id: index,
    imageSrc: getMediaUrl(value),
    name: value,
    metadata: getFileMetadata(value)
  }))
})

const mediaPlaceholder = computed(() => {
  const options = props.widget.options

  // Use widget-provided placeholder if available
  if (options?.placeholder) {
    return options.placeholder
  }

  // Generate placeholder based on media type
  if (options?.image_upload) return 'Select image...'
  if (options?.video_upload) return 'Select video...'
  if (options?.audio_upload) return 'Select audio...'

  // Generic fallback
  return 'Select media...'
})

watch(
  localValue,
  (currentValue) => {
    if (currentValue !== undefined) {
      const index = dropdownItems.value.findIndex(
        (item) => item.name === currentValue
      )
      if (index >= 0) {
        selectedSet.value.clear()
        selectedSet.value.add(index)
      }
    } else {
      selectedSet.value.clear()
    }
  },
  { immediate: true }
)

function updateSelectedItems(selectedItems: Set<number>) {
  let index: number | undefined = undefined
  if (selectedItems.size > 0) {
    index = selectedItems.values().next().value!
  }
  if (index != null) {
    onChange(dropdownItems.value[index].name)
  } else {
    onChange(undefined)
  }
}

function getMediaUrl(filename: string): string {
  // TODO: This needs to be adapted based on actual ComfyUI API structure
  return `/api/view?filename=${encodeURIComponent(filename)}&type=input`
}

function getFileMetadata(filename: string): string {
  const extension = filename.split('.').pop()?.toUpperCase() || ''
  return extension
}
</script>
