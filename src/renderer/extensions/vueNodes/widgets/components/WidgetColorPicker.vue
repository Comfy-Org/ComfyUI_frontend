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
        class="h-4 w-8 overflow-hidden !rounded-full border-none"
        :aria-label="widget.name"
        :pt="{
          preview: '!w-full !h-full !border-none'
        }"
      />
      <span
        class="text-xs truncate min-w-[4ch]"
        data-testid="widget-color-text"
        >{{ toHexFromFormat(localValue, format) }}</span
      >
    </label>
  </WidgetLayoutField>
</template>

<script setup lang="ts">
import ColorPicker from 'primevue/colorpicker'
import { computed } from 'vue'

import type { SimplifiedWidget } from '@/types/simplifiedWidget'
import { isColorFormat, toHexFromFormat } from '@/utils/colorUtil'
import type { ColorFormat } from '@/utils/colorUtil'
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
}>()

const modelValue = props.widget.value()

const format = computed<ColorFormat>(() => {
  const optionFormat = props.widget.options?.format
  return isColorFormat(optionFormat) ? optionFormat : 'hex'
})

const localValue = computed({
  get() {
    return toHexFromFormat(modelValue.value || '#000000', format.value)
  },
  set(v) {
    modelValue.value = toHexFromFormat(v, format.value)
  }
})

// ColorPicker specific excluded props include panel/overlay classes
const COLOR_PICKER_EXCLUDED_PROPS = [...PANEL_EXCLUDED_PROPS] as const

const filteredProps = computed(() =>
  filterWidgetProps(props.widget.options, COLOR_PICKER_EXCLUDED_PROPS)
)
</script>
