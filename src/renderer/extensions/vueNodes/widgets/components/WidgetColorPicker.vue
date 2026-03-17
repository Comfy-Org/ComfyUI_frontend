<template>
  <WidgetLayoutField :widget="widget">
    <ColorPicker v-model="localValue" @update:model-value="onUpdate" />
  </WidgetLayoutField>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'

import type { SimplifiedWidget } from '@/types/simplifiedWidget'
import { isColorFormat, toHexFromFormat } from '@/utils/colorUtil'
import type { ColorFormat } from '@/utils/colorUtil'

import type { IWidgetOptions } from '@/lib/litegraph/src/types/widgets'

import ColorPicker from '@/components/ui/color-picker/ColorPicker.vue'

import WidgetLayoutField from './layout/WidgetLayoutField.vue'

type WidgetOptions = IWidgetOptions & { format?: ColorFormat }

const { widget } = defineProps<{
  widget: SimplifiedWidget<string, WidgetOptions>
}>()

const modelValue = defineModel<string>({ required: true })

const format = isColorFormat(widget.options?.format)
  ? widget.options.format
  : 'hex'

const localValue = ref(toHexFromFormat(modelValue.value || '#000000', format))

watch(modelValue, (newVal) => {
  localValue.value = toHexFromFormat(newVal || '#000000', format)
})

function onUpdate(val: string) {
  localValue.value = val
  modelValue.value = val
}
</script>
