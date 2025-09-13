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
  isHSBObject,
  isHSVObject,
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
const localValue = ref<PickerValue>(props.modelValue ?? '#000000')

watch(
  () => props.modelValue,
  (newVal) => {
    localValue.value = newVal ?? '#000000'
  }
)

const format = computed<ColorFormat>(() => {
  const optionFormat = props.widget.options?.format
  return isColorFormat(optionFormat) ? optionFormat : 'hex'
})

function onPickerUpdate(val: unknown) {
  if (typeof val === 'string') {
    localValue.value = val
  } else if (isHSBObject(val)) {
    localValue.value = val
  } else if (isHSVObject(val)) {
    localValue.value = { h: val.h, s: val.s, b: val.v }
  }
  emit('update:modelValue', toHexFromFormat(val, format.value))
}

// ColorPicker specific excluded props include panel/overlay classes
const COLOR_PICKER_EXCLUDED_PROPS = [...PANEL_EXCLUDED_PROPS] as const

const filteredProps = computed(() =>
  filterWidgetProps(props.widget.options, COLOR_PICKER_EXCLUDED_PROPS)
)
</script>
