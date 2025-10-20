<template>
  <WidgetLayoutField :widget="widget">
    <div
      :class="
        cn(WidgetInputBaseClass, 'flex items-center gap-2 w-full pl-4 pr-2')
      "
    >
      <Slider
        :model-value="[localValue]"
        v-bind="filteredProps"
        class="flex-grow text-xs"
        :step="stepValue"
        :aria-label="widget.name"
        @update:model-value="updateLocalValue"
      />
      <InputNumber
        :key="timesEmptied"
        :model-value="localValue"
        v-bind="filteredProps"
        :step="stepValue"
        :min-fraction-digits="precision"
        :max-fraction-digits="precision"
        :aria-label="widget.name"
        size="small"
        pt:pc-input-text:root="min-w-full bg-transparent border-none text-center"
        class="w-16"
        :show-buttons="!buttonsDisabled"
        :pt="sliderNumberPt"
        @update:model-value="handleNumberInputUpdate"
      />
    </div>
  </WidgetLayoutField>
</template>

<script setup lang="ts">
import InputNumber from 'primevue/inputnumber'
import { computed, ref } from 'vue'

import Slider from '@/components/ui/slider/Slider.vue'
import { useNumberWidgetValue } from '@/composables/graph/useWidgetValue'
import type { SimplifiedWidget } from '@/types/simplifiedWidget'
import { cn } from '@/utils/tailwindUtil'
import {
  STANDARD_EXCLUDED_PROPS,
  filterWidgetProps
} from '@/utils/widgetPropFilter'

import { useNumberWidgetButtonPt } from '../composables/useNumberWidgetButtonPt'
import { WidgetInputBaseClass } from './layout'
import WidgetLayoutField from './layout/WidgetLayoutField.vue'

const { widget, modelValue } = defineProps<{
  widget: SimplifiedWidget<number>
  modelValue: number
}>()

const emit = defineEmits<{
  'update:modelValue': [value: number]
}>()

// Use the composable for consistent widget value handling
const { localValue, onChange } = useNumberWidgetValue(widget, modelValue, emit)

const timesEmptied = ref(0)

const updateLocalValue = (newValue: number[] | undefined): void => {
  onChange(newValue ?? [localValue.value])
}

const handleNumberInputUpdate = (newValue: number | undefined) => {
  if (newValue) {
    updateLocalValue([newValue])
    return
  }
  timesEmptied.value += 1
}

const filteredProps = computed(() =>
  filterWidgetProps(widget.options, STANDARD_EXCLUDED_PROPS)
)

// Get the precision value for proper number formatting
const precision = computed(() => {
  const p = widget.options?.precision
  // Treat negative or non-numeric precision as undefined
  return typeof p === 'number' && p >= 0 ? p : undefined
})

// Calculate the step value based on precision or widget options
const stepValue = computed(() => {
  // Use step2 (correct input spec value) instead of step (legacy 10x value)
  if (widget.options?.step2 !== undefined) {
    return widget.options.step2
  }

  // Otherwise, derive from precision
  if (precision.value === undefined) {
    return undefined
  }

  if (precision.value === 0) {
    return 1
  }

  // For precision > 0, step = 1 / (10^precision)
  // precision 1 → 0.1, precision 2 → 0.01, etc.
  return 1 / Math.pow(10, precision.value)
})

const buttonsDisabled = computed(() => {
  const currentValue = localValue.value ?? 0
  return (
    !Number.isFinite(currentValue) ||
    Math.abs(currentValue) > Number.MAX_SAFE_INTEGER
  )
})

const sliderNumberPt = useNumberWidgetButtonPt({
  roundedLeft: true,
  roundedRight: true
})
</script>

<style scoped>
:deep(.p-inputnumber-button.p-disabled .pi),
:deep(.p-inputnumber-button.p-disabled .p-icon) {
  color: var(--color-node-icon-disabled) !important;
}
</style>
