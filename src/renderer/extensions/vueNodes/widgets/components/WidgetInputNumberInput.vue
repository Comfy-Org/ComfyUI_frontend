<script setup lang="ts">
import InputNumber from 'primevue/inputnumber'
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
</script>

<template>
  <WidgetLayoutField :widget>
    <InputNumber
      v-model="modelValue"
      v-tooltip="buttonTooltip"
      v-bind="filteredProps"
      fluid
      button-layout="horizontal"
      size="small"
      variant="outlined"
      :step="stepValue"
      :min-fraction-digits="precision"
      :max-fraction-digits="precision"
      :use-grouping="useGrouping"
      :class="cn(WidgetInputBaseClass, 'grow text-xs')"
      :aria-label="widget.name"
      :show-buttons="!buttonsDisabled"
      :pt="{
        root: {
          class: cn(
            '[&>input]:bg-transparent [&>input]:border-0',
            '[&>input]:truncate [&>input]:min-w-[4ch]',
            $slots.default && '[&>input]:pr-7'
          )
        },
        decrementButton: {
          class: 'w-8 border-0'
        },
        incrementButton: {
          class: 'w-8 border-0'
        }
      }"
    >
      <template #incrementicon>
        <span class="pi pi-plus text-sm" />
      </template>
      <template #decrementicon>
        <span class="pi pi-minus text-sm" />
      </template>
    </InputNumber>
    <div
      v-if="$slots.default"
      class="absolute top-5 right-8 h-4 w-7 -translate-y-4/5 flex"
    >
      <slot />
    </div>
  </WidgetLayoutField>
</template>

<style scoped>
:deep(.p-inputnumber-input) {
  height: 1.625rem;
  margin: 1px 0;
  box-shadow: none;
}
</style>
