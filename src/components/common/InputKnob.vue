<template>
  <div class="input-knob flex flex-row items-center gap-2">
    <KnobControl
      :model-value="modelValue"
      class="knob-part"
      :class="knobClass"
      :min="min"
      :max="max"
      :step="step"
      v-bind="$attrs"
      @update:model-value="updateValue"
    />
    <FormattedNumberStepper
      :model-value="modelValue"
      class="input-part"
      :format-options="{ maximumFractionDigits: 3 }"
      :class="inputClass"
      :min="min"
      :max="max"
      :step="step"
      @update:model-value="updateValue"
    />
  </div>
</template>

<script setup lang="ts">
import KnobControl from '@/components/common/KnobControl.vue'
import FormattedNumberStepper from '@/components/ui/stepper/FormattedNumberStepper.vue'

const { modelValue, inputClass, knobClass, min, max, step } = defineProps<{
  modelValue: number
  inputClass?: string
  knobClass?: string
  min?: number
  max?: number
  step?: number
}>()

const emit = defineEmits<{
  (e: 'update:modelValue', value: number): void
}>()

const updateValue = (newValue: number | null) => {
  if (newValue === null) {
    newValue = Number(min) || 0
  }

  const minimum = Number(min ?? Number.NEGATIVE_INFINITY)
  const maximum = Number(max ?? Number.POSITIVE_INFINITY)
  const increment = Number(step) || 1

  newValue = Math.max(minimum, Math.min(maximum, newValue))
  newValue = Math.round(newValue / increment) * increment
  emit('update:modelValue', newValue)
}

defineOptions({
  inheritAttrs: false
})
</script>
