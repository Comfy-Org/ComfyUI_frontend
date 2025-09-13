<!-- Needs custom color picker for alpha support -->
<template>
  <WidgetLayoutField :widget="widget">
    <label
      :class="
        cn(WidgetInputBaseClass, 'flex items-center gap-2 w-full px-4 py-2')
      "
    >
      <ColorPicker
        v-model="localValue"
        v-bind="filteredProps"
        :disabled="readonly"
        class="w-8 h-4 !rounded-full overflow-hidden border-none"
        :pt="{
          preview: '!w-full !h-full !border-none'
        }"
        @update:model-value="onPickerUpdate"
      />
      <span class="text-xs" data-testid="widget-color-text">{{
        toHexFromFormat(localValue, format)
      }}</span>
    </label>
  </WidgetLayoutField>
</template>

<script setup lang="ts">
import ColorPicker from 'primevue/colorpicker'
import { computed, ref, watch } from 'vue'

import type { SimplifiedWidget } from '@/types/simplifiedWidget'
import {
  type ColorFormat,
  type HSB,
  isColorFormat,
  toHexFromFormat
} from '@/utils/colorUtil'
import { cn } from '@/utils/tailwindUtil'
import {
  PANEL_EXCLUDED_PROPS,
  filterWidgetProps
} from '@/utils/widgetPropFilter'

import { WidgetInputBaseClass } from './layout'
import WidgetLayoutField from './layout/WidgetLayoutField.vue'

type WidgetOptions = { format?: ColorFormat } & Record<string, unknown>

const props = defineProps<{
  widget: SimplifiedWidget<string, WidgetOptions>
  modelValue: string
  readonly?: boolean
}>()

const emit = defineEmits<{
  'update:modelValue': [value: string]
}>()

type PickerValue = string | HSB
const localValue = ref<PickerValue>(
  normalizeColorValue(
    props.modelValue,
    isColorFormat(props.widget.options?.format)
      ? props.widget.options.format
      : 'hex'
  )
)

watch(
  () => props.modelValue,
  (newVal) => {
    localValue.value = normalizeColorValue(newVal, format.value)
  }
)

const format = computed<ColorFormat>(() => {
  const optionFormat = props.widget.options?.format
  return isColorFormat(optionFormat) ? optionFormat : 'hex'
})

function normalizeColorValue(value: string, colorFormat: ColorFormat): string {
  if (!value) return '#000000'

  // Use the fancy color parsing but respect the specified format
  return toHexFromFormat(value, colorFormat)
}

function onPickerUpdate(val: unknown) {
  // Store the picker's value directly
  localValue.value = val as PickerValue

  // Convert to hex using the widget's configured format
  // The picker should emit values in the format we configured it for
  emit('update:modelValue', toHexFromFormat(val, format.value))
}

// ColorPicker specific excluded props include panel/overlay classes
const COLOR_PICKER_EXCLUDED_PROPS = [...PANEL_EXCLUDED_PROPS] as const

const filteredProps = computed(() =>
  filterWidgetProps(props.widget.options, COLOR_PICKER_EXCLUDED_PROPS)
)
</script>
