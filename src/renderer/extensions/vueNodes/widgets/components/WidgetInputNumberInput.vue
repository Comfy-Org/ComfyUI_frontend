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
  readonly?: boolean
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
</script>

<template>
  <WidgetLayoutField :widget>
    <InputNumber
      v-model="modelValue"
      v-bind="filteredProps"
      show-buttons
      button-layout="horizontal"
      size="small"
      :disabled="readonly"
      :step="stepValue"
      :use-grouping="useGrouping"
      :class="cn(WidgetInputBaseClass, 'w-full text-xs')"
      :pt="{
        incrementButton:
          '!rounded-r-lg bg-transparent border-none hover:bg-zinc-500/30 active:bg-zinc-500/40',
        decrementButton:
          '!rounded-l-lg bg-transparent border-none hover:bg-zinc-500/30 active:bg-zinc-500/40'
      }"
    >
      <template #incrementicon>
        <span class="pi pi-plus text-sm" />
      </template>
      <template #decrementicon>
        <span class="pi pi-minus text-sm" />
      </template>
    </InputNumber>
  </WidgetLayoutField>
</template>

<style scoped>
:deep(.p-inputnumber-input) {
  background-color: transparent;
  border: 1px solid color-mix(in oklab, #d4d4d8 10%, transparent);
  border-top: transparent;
  border-bottom: transparent;
  height: 1.625rem;
  margin: 1px 0;
  box-shadow: none;
}
</style>
