<script setup lang="ts">
import {
  NumberFieldDecrement,
  NumberFieldIncrement,
  NumberFieldInput,
  NumberFieldRoot
} from 'reka-ui'
import { computed } from 'vue'

import type { SimplifiedWidget } from '@/types/simplifiedWidget'
import { cn } from '@/utils/tailwindUtil'
import {
  INPUT_EXCLUDED_PROPS,
  filterWidgetProps
} from '@/utils/widgetPropFilter'

import { WidgetInputBaseClass } from './layout'
import WidgetLayoutField from './layout/WidgetLayoutField.vue'

const props = defineProps<{
  widget: SimplifiedWidget<number>
}>()

const modelValue = defineModel<number>({ default: 0 })

const filteredProps = computed(() =>
  filterWidgetProps(props.widget.options, INPUT_EXCLUDED_PROPS)
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
    return Number(props.widget.options.step2)
  }
  // Otherwise, derive from precision
  if (precision.value !== undefined) {
    if (precision.value === 0) {
      return 1
    }
    // For precision > 0, step = 1 / (10^precision)
    // precision 1 → 0.1, precision 2 → 0.01, etc.
    return Number((1 / Math.pow(10, precision.value)).toFixed(precision.value))
  }
  // Default to 'any' for unrestricted stepping
  return 0
})

// Disable grouping separators by default unless explicitly enabled by the node author
const useGrouping = computed(() => {
  return props.widget.options?.useGrouping === true
})

// Check if increment/decrement buttons should be disabled due to precision limits
const buttonsDisabled = computed(() => {
  const currentValue = modelValue.value ?? 0
  return (
    !Number.isFinite(currentValue) ||
    Math.abs(currentValue) > Number.MAX_SAFE_INTEGER
  )
})

const buttonTooltip = computed(() => {
  if (buttonsDisabled.value) {
    return 'Increment/decrement disabled: value exceeds JavaScript precision limit (±2^53)'
  }
  return null
})

const sharedButtonClass = 'w-8 bg-transparent border-0 text-sm text-smoke-700'
const canDecrement = computed(() => modelValue.value > filteredProps.value.min)
const canIncrement = computed(() => modelValue.value < filteredProps.value.max)
const decrementClass = computed(() =>
  cn(sharedButtonClass, 'pi pi-minus', !canDecrement.value && 'opacity-60')
)
const incrementClass = computed(() =>
  cn(sharedButtonClass, 'pi pi-plus', !canIncrement.value && 'opacity-60')
)
const fieldInputClass = computed(() =>
  cn(
    'bg-transparent border-0 focus:outline-0 p-1 flex-1',
    'min-w-[4ch] truncate py-1.5 my-0.25 text-sm'
  )
)
</script>

<template>
  <WidgetLayoutField :widget>
    <NumberFieldRoot
      v-bind="filteredProps"
      ref="numberFieldRoot"
      v-model="modelValue"
      v-tooltip="buttonTooltip"
      :aria-label="widget.name"
      :class="cn(WidgetInputBaseClass, 'grow text-xs flex h-7')"
      :step="stepValue"
      :format-options="{
        useGrouping,
        minimumFractionDigits: precision,
        maximumFractionDigits: precision
      }"
    >
      <NumberFieldDecrement
        v-if="!buttonsDisabled"
        :class="decrementClass"
        :disabled="!canDecrement"
      />
      <NumberFieldInput :class="fieldInputClass" />
      <slot />
      <NumberFieldIncrement
        v-if="!buttonsDisabled"
        :class="incrementClass"
        :disabled="!canIncrement"
        @mouseup="console.log('up')"
      />
    </NumberFieldRoot>
  </WidgetLayoutField>
</template>

<style scoped>
:deep(.p-inputnumber-input) {
  height: 1.625rem;
  margin: 1px 0;
  box-shadow: none;
}
</style>
