<script setup lang="ts">
import InputNumber from 'primevue/inputnumber'
import { computed, watch } from 'vue'

import { useNumberWidgetValue } from '@/composables/graph/useWidgetValue'
import type { SimplifiedWidget } from '@/types/simplifiedWidget'
import { cn } from '@/utils/tailwindUtil'
import {
  INPUT_EXCLUDED_PROPS,
  filterWidgetProps
} from '@/utils/widgetPropFilter'

import { useNumberStepCalculation } from '../composables/useNumberStepCalculation'
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

watch(
  () => props.modelValue,
  (newValue) => {
    if (newValue !== localValue.value) {
      localValue.value = newValue
    }
  }
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
const stepValue = useNumberStepCalculation(props.widget.options, precision)

// Disable grouping separators by default unless explicitly enabled by the node author
const useGrouping = computed(() => {
  return props.widget.options?.useGrouping === true
})

// Check if increment/decrement buttons should be disabled due to precision limits
const buttonsDisabled = computed(() => {
  const currentValue = localValue.value || 0
  return !Number.isSafeInteger(currentValue)
})

// Tooltip message for disabled buttons
const buttonTooltip = computed(() => {
  if (buttonsDisabled.value) {
    return 'Increment/decrement disabled: value exceeds JavaScript precision limit (±2^53)'
  }
  return null
})
</script>

<template>
  <WidgetLayoutField :widget>
    <div v-tooltip="buttonTooltip">
      <InputNumber
        v-model="localValue"
        v-bind="filteredProps"
        :show-buttons="!buttonsDisabled"
        button-layout="horizontal"
        size="small"
        :step="stepValue"
        :use-grouping="useGrouping"
        :class="cn(WidgetInputBaseClass, 'w-full text-xs')"
        :aria-label="widget.name"
        :pt="{
          incrementButton:
            '!rounded-r-lg bg-transparent border-none hover:bg-zinc-500/30 active:bg-zinc-500/40',
          decrementButton:
            '!rounded-l-lg bg-transparent border-none hover:bg-zinc-500/30 active:bg-zinc-500/40'
        }"
        @update:model-value="onChange"
      >
        <template #incrementicon>
          <span class="pi pi-plus text-sm" />
        </template>
        <template #decrementicon>
          <span class="pi pi-minus text-sm" />
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
</style>
