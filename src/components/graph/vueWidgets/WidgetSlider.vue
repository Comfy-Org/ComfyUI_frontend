<template>
  <div class="flex items-center gap-4">
    <label v-if="widget.name" class="text-xs opacity-80 min-w-[4em] truncate">{{
      widget.name
    }}</label>
    <div class="flex items-center gap-2 flex-1 justify-end">
      <Slider
        v-model="localValue"
        v-bind="filteredProps"
        :disabled="readonly"
        class="flex-grow min-w-[8em] max-w-[20em] text-xs"
        @update:model-value="onChange"
      />
      <InputText
        :value="String(localValue)"
        :disabled="readonly"
        type="number"
        :min="widget.options?.min"
        :max="widget.options?.max"
        :step="widget.options?.step"
        class="w-[4em] text-center text-xs px-0"
        size="small"
        @input="handleInputChange"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import InputText from 'primevue/inputtext'
import Slider from 'primevue/slider'
import { computed } from 'vue'

import { useNumberWidgetValue } from '@/composables/graph/useWidgetValue'
import type { SimplifiedWidget } from '@/types/simplifiedWidget'
import {
  STANDARD_EXCLUDED_PROPS,
  filterWidgetProps
} from '@/utils/widgetPropFilter'

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

const filteredProps = computed(() =>
  filterWidgetProps(props.widget.options, STANDARD_EXCLUDED_PROPS)
)

const handleInputChange = (event: Event) => {
  const target = event.target as HTMLInputElement
  const value = parseFloat(target.value)

  if (!isNaN(value)) {
    const min = props.widget.options?.min ?? -Infinity
    const max = props.widget.options?.max ?? Infinity
    const clampedValue = Math.min(Math.max(value, min), max)
    localValue.value = clampedValue
    onChange(clampedValue)
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
