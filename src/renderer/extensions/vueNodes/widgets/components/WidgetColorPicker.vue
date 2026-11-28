<template>
  <WidgetLayoutField :widget-id :display-label :input-id>
    <AppColorPicker
      v-model="localValue"
      :trigger-id="inputId"
      :alpha="format !== 'int'"
      align="end"
      class="bg-transparent"
      @update:model-value="onUpdate"
    />
  </WidgetLayoutField>
</template>

<script setup lang="ts">
import { computed, ref, useId, watch } from 'vue'

import { widgetOptions } from '@/renderer/extensions/vueNodes/widgets/widgetEntity'
import type { WidgetId } from '@comfyorg/graph-model/widgetId'
import {
  hexToInt,
  intToHex,
  isColorFormat,
  toHexFromFormat
} from '@comfyorg/shared-frontend-utils/colorUtil'

import type { IColorWidgetOptions } from '@comfyorg/graph-model/widgets'

import AppColorPicker from '@/components/common/AppColorPicker.vue'

import WidgetLayoutField from './layout/WidgetLayoutField.vue'

type ColorWidgetValue = string | number

const { widgetId, displayLabel } = defineProps<{
  widgetId: WidgetId
  displayLabel?: string
}>()

const modelValue = defineModel<ColorWidgetValue>({ required: true })
const inputId = useId()

const format = computed(() => {
  const { format: optionFormat }: IColorWidgetOptions = widgetOptions(widgetId)
  return optionFormat === 'int' || isColorFormat(optionFormat)
    ? optionFormat
    : 'hex'
})

function toPickerValue(value: ColorWidgetValue): string {
  if (format.value === 'int') {
    return typeof value === 'number' ? intToHex(value) : '#000000'
  }
  return toHexFromFormat(value || '#000000', format.value)
}

const localValue = ref(toPickerValue(modelValue.value))

watch([modelValue, format], ([newVal]) => {
  localValue.value = toPickerValue(newVal)
})

function onUpdate(val: string) {
  localValue.value = val
  modelValue.value = format.value === 'int' ? hexToInt(val) : val
}
</script>
