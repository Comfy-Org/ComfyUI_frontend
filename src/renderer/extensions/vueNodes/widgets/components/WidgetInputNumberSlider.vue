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
        :disabled="readonly"
        class="flex-grow text-xs"
        @update:model-value="updateLocalValue"
      />
      <InputText
        v-model="inputDisplayValue"
        :disabled="readonly"
        type="number"
        :step="stepValue"
        class="w-[4em] text-center text-xs px-0 !border-none !shadow-none !bg-transparent"
        size="small"
        @blur="handleInputBlur"
        @keydown="handleInputKeydown"
      />
    </div>
  </WidgetLayoutField>
</template>

<script setup lang="ts">
import InputText from 'primevue/inputtext'
import { computed, ref, watch } from 'vue'

import Slider from '@/components/ui/slider/Slider.vue'
import { useNumberWidgetValue } from '@/composables/graph/useWidgetValue'
import type { SimplifiedWidget } from '@/types/simplifiedWidget'
import { cn } from '@/utils/tailwindUtil'
import {
  STANDARD_EXCLUDED_PROPS,
  filterWidgetProps
} from '@/utils/widgetPropFilter'

import { WidgetInputBaseClass } from './layout'
import WidgetLayoutField from './layout/WidgetLayoutField.vue'

const props = defineProps<{
  widget: SimplifiedWidget<number>
  modelValue: number
  readonly?: boolean
}>()

const emit = defineEmits<{
  'update:modelValue': [value: number]
}>()

// Use the composable for consistent widget value handling
const { localValue, onChange } = useNumberWidgetValue(
  props.widget,
  props.modelValue,
  emit
)

const updateLocalValue = (newValue: number[] | undefined): void => {
  onChange(newValue ?? [])
}

const filteredProps = computed(() =>
  filterWidgetProps(props.widget.options, STANDARD_EXCLUDED_PROPS)
)

// Get the precision value for proper number formatting
const precision = computed(() => {
  const p = props.widget.options?.precision
  // Treat negative or non-numeric precision as undefined
  return typeof p === 'number' && p >= 0 ? p : undefined
})

// Calculate the step value based on precision or widget options
const stepValue = computed(() => {
  // Use step2 (correct input spec value) instead of step (legacy 10x value)
  if (props.widget.options?.step2 !== undefined) {
    return String(props.widget.options.step2)
  }
  // Otherwise, derive from precision
  if (precision.value !== undefined) {
    if (precision.value === 0) {
      return '1'
    }
    // For precision > 0, step = 1 / (10^precision)
    // precision 1 → 0.1, precision 2 → 0.01, etc.
    return (1 / Math.pow(10, precision.value)).toFixed(precision.value)
  }
  // Default to 'any' for unrestricted stepping
  return 'any'
})

// Format a number according to the widget's precision
const formatNumber = (value: number): string => {
  if (precision.value === undefined) {
    // No precision specified, return as-is
    return String(value)
  }
  // Use toFixed to ensure correct decimal places
  return value.toFixed(precision.value)
}

// Apply precision-based rounding to a number
const applyPrecision = (value: number): number => {
  if (precision.value === undefined) {
    // No precision specified, return as-is
    return value
  }
  if (precision.value === 0) {
    // Integer precision
    return Math.round(value)
  }
  // Round to the specified decimal places
  const multiplier = Math.pow(10, precision.value)
  return Math.round(value * multiplier) / multiplier
}

// Keep a separate display value for the input field
const inputDisplayValue = ref(formatNumber(localValue.value))

// Update display value when localValue changes from external sources
watch(localValue, (newValue) => {
  inputDisplayValue.value = formatNumber(newValue)
})

const handleInputBlur = (event: Event) => {
  const target = event.target as HTMLInputElement
  const value = target.value || '0'
  const parsed = parseFloat(value)

  if (!isNaN(parsed)) {
    // Apply precision-based rounding
    const roundedValue = applyPrecision(parsed)
    onChange(roundedValue)
    // Update display value with proper formatting
    inputDisplayValue.value = formatNumber(roundedValue)
  }
}

const handleInputKeydown = (event: KeyboardEvent) => {
  if (event.key === 'Enter') {
    const target = event.target as HTMLInputElement
    const value = target.value || '0'
    const parsed = parseFloat(value)

    if (!isNaN(parsed)) {
      // Apply precision-based rounding
      const roundedValue = applyPrecision(parsed)
      onChange(roundedValue)
      // Update display value with proper formatting
      inputDisplayValue.value = formatNumber(roundedValue)
    }
  }
}
</script>

<style scoped>
/* Remove number input spinners */
:deep(input[type='number']::-webkit-inner-spin-button),
:deep(input[type='number']::-webkit-outer-spin-button) {
  -webkit-appearance: none;
  margin: 0;
}

:deep(input[type='number']) {
  -moz-appearance: textfield;
  appearance: textfield;
}
</style>
