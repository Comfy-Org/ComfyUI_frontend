<template>
  <div class="input-knob flex flex-row items-center gap-2">
    <Knob
      :model-value="modelValue"
      :value-template="displayValue"
      class="knob-part"
      :class="knobClass"
      :min="min"
      :max="max"
      :step="step"
      v-bind="$attrs"
      @update:model-value="updateValue"
    />
    <InputNumber
      :model-value="modelValue"
      class="input-part"
      :max-fraction-digits="3"
      :class="inputClass"
      :min="min"
      :max="max"
      :step="step"
      :allow-empty="false"
      @update:model-value="updateValue"
    />
  </div>
</template>

<script setup lang="ts">
import InputNumber from 'primevue/inputnumber'
import Knob from 'primevue/knob'
import { ref, watch } from 'vue'

const { modelValue, inputClass, knobClass, min, max, step, resolution } =
  defineProps<{
    modelValue: number
    inputClass?: string
    knobClass?: string
    min?: number
    max?: number
    step?: number
    resolution?: number
  }>()

const emit = defineEmits<{
  (e: 'update:modelValue', value: number): void
}>()

const localValue = ref(modelValue)

watch(
  () => modelValue,
  (newValue) => {
    localValue.value = newValue
  }
)

const updateValue = (newValue: number | null) => {
  if (newValue === null) {
    // If the input is cleared, reset to the minimum value or 0
    newValue = Number(min) || 0
  }

  const minVal = Number(min ?? Number.NEGATIVE_INFINITY)
  const maxVal = Number(max ?? Number.POSITIVE_INFINITY)
  const stepVal = Number(step) || 1

  // Ensure the value is within the allowed range
  newValue = Math.max(minVal, Math.min(maxVal, newValue))

  // Round to the nearest step
  newValue = Math.round(newValue / stepVal) * stepVal

  // Update local value and emit change
  localValue.value = newValue
  emit('update:modelValue', newValue)
}

const displayValue = (value: number): string => {
  updateValue(value)
  const stepString = (step ?? 1).toString()
  const decimalPlaces = stepString.includes('.')
    ? stepString.split('.')[1].length
    : 0
  return value.toFixed(resolution ?? decimalPlaces)
}

defineOptions({
  inheritAttrs: false
})
</script>
