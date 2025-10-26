<script setup lang="ts">
import InputNumber from 'primevue/inputnumber'
import { computed } from 'vue'

import { useNumberWidgetValue } from '@/composables/graph/useWidgetValue'
import type { SimplifiedWidget } from '@/types/simplifiedWidget'
import { cn } from '@/utils/tailwindUtil'
import {
  INPUT_EXCLUDED_PROPS,
  filterWidgetProps
} from '@/utils/widgetPropFilter'

import { useNumberWidgetButtonPt } from '../composables/useNumberWidgetButtonPt'
import { WidgetInputBaseClass } from './layout'
import WidgetLayoutField from './layout/WidgetLayoutField.vue'

const props = defineProps<{
  widget: SimplifiedWidget<number>
  modelValue: number
}>()

const emit = defineEmits<{
  'update:modelValue': [value: number]
}>()

const { localValue, onChange } = useNumberWidgetValue(
  props.widget,
  props.modelValue,
  emit
)

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
  const currentValue = localValue.value ?? 0
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

const inputNumberPt = useNumberWidgetButtonPt({
  roundedLeft: true,
  roundedRight: true
})
</script>

<template>
  <WidgetLayoutField :widget>
    <div v-tooltip="buttonTooltip">
      <InputNumber
        v-model="localValue"
        v-bind="filteredProps"
        button-layout="horizontal"
        size="small"
        :step="stepValue"
        :use-grouping="useGrouping"
        :class="cn(WidgetInputBaseClass, 'w-full text-xs')"
        :aria-label="widget.name"
        :show-buttons="!buttonsDisabled"
        :pt="inputNumberPt"
        @update:model-value="onChange"
      >
        <template #incrementicon>
          <span class="pi pi-plus text-sm text-button-icon" />
        </template>
        <template #decrementicon>
          <span class="pi pi-minus text-sm text-button-icon" />
        </template>
      </InputNumber>
    </div>
  </WidgetLayoutField>
</template>

<style scoped>
:deep(.p-inputnumber-input) {
  background-color: transparent;
  border: 1px solid var(--node-stroke);
  border-top: transparent;
  border-bottom: transparent;
  height: 1.625rem;
  margin: 1px 0;
  box-shadow: none;
}

:deep(.p-inputnumber-button.p-disabled .pi),
:deep(.p-inputnumber-button.p-disabled .p-icon) {
  color: var(--color-node-icon-disabled) !important;
}
</style>
