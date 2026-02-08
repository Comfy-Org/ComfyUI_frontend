<template>
  <div class="input-slider flex flex-row items-center gap-2">
    <Slider
      :model-value="modelValue"
      class="slider-part"
      :class="sliderClass"
      :min="min"
      :max="max"
      :step="step"
      v-bind="$attrs"
      @update:model-value="(value) => updateValue(value as number)"
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
import Slider from 'primevue/slider'
import { ref, watch } from 'vue'

const { modelValue, inputClass, sliderClass, min, max, step } = defineProps<{
  modelValue: number
  inputClass?: string
  sliderClass?: string
  min?: number
  max?: number
  step?: number
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

defineOptions({
  inheritAttrs: false
})
</script>
