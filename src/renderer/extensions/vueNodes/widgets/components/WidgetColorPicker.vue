<template>
  <WidgetLayoutField :widget="widget">
    <ColorPicker
      v-model="localValue"
      :alpha="format !== 'int'"
      @update:model-value="onUpdate"
    />
  </WidgetLayoutField>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'

import type { SimplifiedWidget } from '@/types/simplifiedWidget'
import {
  hexToInt,
  intToHex,
  isColorFormat,
  toHexFromFormat
} from '@/utils/colorUtil'

import type { IColorWidgetOptions } from '@/lib/litegraph/src/types/widgets'

import ColorPicker from '@/components/ui/color-picker/ColorPicker.vue'

import WidgetLayoutField from './layout/WidgetLayoutField.vue'

type ColorWidgetValue = string | number

const { widget } = defineProps<{
  widget: SimplifiedWidget<ColorWidgetValue, IColorWidgetOptions>
}>()

const modelValue = defineModel<ColorWidgetValue>({ required: true })

const format =
  widget.options?.format === 'int' || isColorFormat(widget.options?.format)
    ? widget.options.format
    : 'hex'

function toPickerValue(value: ColorWidgetValue): string {
  if (format === 'int') {
    return typeof value === 'number' ? intToHex(value) : '#000000'
  }
  return toHexFromFormat(value || '#000000', format)
}

const localValue = ref(toPickerValue(modelValue.value))

watch(modelValue, (newVal) => {
  localValue.value = toPickerValue(newVal)
})

function onUpdate(val: string) {
  localValue.value = val
  modelValue.value = format === 'int' ? hexToInt(val) : val
}
</script>
